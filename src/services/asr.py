import os
import re
import json
import asyncio
import subprocess
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor

from faster_whisper import WhisperModel
from loguru import logger

from src.config import settings
from src.models.schemas import SubtitleSegment, TranscribeResponse

class ASRService:
    _instance = None
    _model_instance = None
    _current_model_name = None

    def __new__(cls):
        """Singleton pattern ensuring only one service instance exists."""
        if cls._instance is None:
            cls._instance = super(ASRService, cls).__new__(cls)
            cls._instance.executor = ThreadPoolExecutor(max_workers=2) # Limit concurrency
        return cls._instance

    def _load_model(self, model_name: str, device: str):
        """
        Load or reload the Whisper model securely from the local models directory.
        """
        # Return existing model if name matches and it's loaded
        if self._model_instance and self._current_model_name == model_name:
            return self._model_instance
            
        logger.info(f"Loading Whisper Model: {model_name} on {device}...")
        
        try:
            compute_type = "float16" if device == "cuda" else "int8"
            
            # Ensure model directory exists
            settings.MODEL_DIR.mkdir(parents=True, exist_ok=True)
            
            # Load model (automatic download to validated directory)
            self._model_instance = WhisperModel(
                model_name,
                device=device,
                compute_type=compute_type,
                download_root=str(settings.MODEL_DIR)
            )
            self._current_model_name = model_name
            logger.success(f"Model {model_name} loaded successfully.")
            return self._model_instance
            
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            raise RuntimeError(f"Model loading failed: {e}")

    def _get_audio_duration(self, audio_path: str) -> float:
        """Get audio duration using ffprobe."""
        try:
            cmd = [
                "ffprobe", 
                "-v", "error", 
                "-show_entries", "format=duration", 
                "-of", "default=noprint_wrappers=1:nokey=1", 
                audio_path
            ]
            # Use settings.BIN_DIR logic if needed, but assuming system path for now based on config
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return float(result.stdout.strip())
        except Exception as e:
            logger.error(f"Failed to get duration: {e}")
            return 0.0

    def _detect_silence(self, audio_path: str, silence_thresh: str = "-30dB", min_silence_dur: float = 0.5) -> List[Tuple[float, float]]:
        """
        Detect silence intervals using ffmpeg silencedetect filter.
        Returns a list of (start, end) tuples for silence.
        """
        logger.info("Detecting silence intervals...")
        cmd = [
            "ffmpeg",
            "-i", audio_path,
            "-af", f"silencedetect=noise={silence_thresh}:d={min_silence_dur}",
            "-f", "null",
            "-"
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
            # ffmpeg writes silencedetect output to stderr
            output = result.stderr
            
            silence_starts = []
            silence_ends = []
            
            # Parse output
            for line in output.split('\n'):
                if "silence_start" in line:
                    match = re.search(r"silence_start: (\d+(\.\d+)?)", line)
                    if match:
                        silence_starts.append(float(match.group(1)))
                elif "silence_end" in line:
                    match = re.search(r"silence_end: (\d+(\.\d+)?)", line)
                    if match:
                        silence_ends.append(float(match.group(1)))
            
            # Combine into intervals
            intervals = []
            # Ensure we only pair valid starts and ends
            for s, e in zip(silence_starts, silence_ends):
                intervals.append((s, e))
                
            logger.debug(f"Detected {len(intervals)} silence intervals.")
            return intervals
            
        except Exception as e:
            logger.warning(f"Silence detection failed: {e}")
            return []

    def _calculate_split_points(self, total_duration: float, silence_intervals: List[Tuple[float, float]], target_chunk_duration: float = 600) -> List[float]:
        """
        Calculate safe split points based on silence intervals.
        Target chunk duration default: 600s (10 minutes).
        """
        split_points = []
        current_time = 0.0
        
        while current_time + target_chunk_duration < total_duration:
            target_time = current_time + target_chunk_duration
            
            # Find closest silence interval to target_time
            best_split_point = None
            min_dist = float('inf')
            
            # Search window: target_time +/- 60 seconds (1 minute)
            search_start = max(current_time + 60, target_time - 60) 
            search_end = min(total_duration - 10, target_time + 60)
            
            valid_silences = [
                (s, e) for s, e in silence_intervals 
                if s >= search_start and s <= search_end
            ]
            
            if valid_silences:
                # Pick the middle of the longest silence near target
                # Heuristic: Prefer split point closer to target, but prioritize longer silence?
                # Simple approach: Find detected silence closest to target_time
                closest_silence = min(valid_silences, key=lambda x: abs(x[0] - target_time))
                # Split in the middle of silence
                best_split_point = (closest_silence[0] + closest_silence[1]) / 2
            else:
                # Fallback: Hard split if no silence found (rare for 10 min chunks)
                logger.warning(f"No silence found near {target_time}s. Hard splitting.")
                best_split_point = target_time
            
            split_points.append(best_split_point)
            current_time = best_split_point
            
        return split_points

    def _split_audio_physically(self, audio_path: str, split_points: List[float], output_dir: Path) -> List[Tuple[str, float]]:
        """
        Split audio file into physical chunks using ffmpeg stream copy.
        Returns list of (chunk_path, start_offset_seconds).
        """
        chunks = []
        current_start = 0.0
        
        # Add end of file as final point
        all_points = split_points + [None] 
        
        base_name = Path(audio_path).stem
        
        for idx, end_point in enumerate(all_points):
            chunk_filename = f"{base_name}_part{idx:03d}.mp3" # Convert to mp3 for whisper input usually fine
            chunk_path = output_dir / chunk_filename
            
            cmd = [
                "ffmpeg", "-y",
                "-i", audio_path,
                "-ss", f"{current_start:.3f}",
            ]
            
            if end_point is not None:
                duration = end_point - current_start
                cmd.extend(["-t", f"{duration:.3f}"])
            
            # Re-encode to mp3 for compatibility/size, or copy if source is compatible?
            # Using copy is faster but keyframes might be an issue for precision. 
            # Re-encoding strictly ensures clean cuts. Faster-whisper handles mp3/wav.
            # Let's use fast mp3 encoding.
            cmd.extend(["-c:a", "libmp3lame", "-q:a", "4", str(chunk_path)])
            # cmd.extend(["-c", "copy", str(chunk_path)]) # Copy might be inaccurate with -ss
            
            try:
                subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
                chunks.append((str(chunk_path), current_start))
                current_start = end_point if end_point else 0 # Next start
            except Exception as e:
                logger.error(f"Failed to create chunk {idx}: {e}")
                
        return chunks

    def transcribe(self, audio_path: str, model_name: str = "base", device: str = "cpu", language: str = None, task_id: str = None, progress_callback=None) -> TranscribeResponse:
        """
        Main entry point for transcription. Handled in a blocking manner here, called via executor from API.
        """
        if not os.path.exists(audio_path):
            logger.error(f"Audio file not found: {audio_path}")
            raise FileNotFoundError(f"File not found: {audio_path}")

        # 1. Load Model
        model = self._load_model(model_name, device)
        
        # 2. Analyze Audio
        duration = self._get_audio_duration(audio_path)
        logger.info(f"Audio Duration: {duration:.2f}s")
        
        # 3. Strategy Decision
        # If > 15 minutes, use Smart Splitting. Else direct transcribe.
        if duration > 900: 
            logger.info("Long audio detected. Using VAD Smart Splitting strategy.")
            if progress_callback: progress_callback(10, "Splitting audio...")

            # Detect Silence
            silence_intervals = self._detect_silence(audio_path)
            
            # Calculate Split Points
            split_points = self._calculate_split_points(duration, silence_intervals)
            logger.info(f"Calculated {len(split_points)} split points: {[f'{p:.1f}s' for p in split_points]}")
            
            # Create Temp Dir for Chunks
            chunk_dir = settings.TEMP_DIR / f"chunks_{Path(audio_path).stem}"
            chunk_dir.mkdir(parents=True, exist_ok=True)
            
            # Physical Slicing
            chunks = self._split_audio_physically(audio_path, split_points, chunk_dir)
            logger.info(f"Split into {len(chunks)} physical chunks.")
            if progress_callback: progress_callback(20, f"Split into {len(chunks)} chunks. Starting transcription...")

            # Parallel Transcription
            all_segments = []
            total_chunks = len(chunks)
            completed_chunks = 0
            
            def process_chunk(chunk_info):
                c_path, c_offset = chunk_info
                logger.info(f"Transcribing chunk starting at {c_offset:.1f}s...")
                segs, _ = model.transcribe(
                    c_path, 
                    beam_size=5, 
                    language=language, 
                    vad_filter=True 
                )
                
                # Convert and Correct Timestamps
                chunk_segments = []
                for s in segs:
                    chunk_segments.append(SubtitleSegment(
                        id=0, 
                        start=s.start + c_offset,
                        end=s.end + c_offset,
                        text=s.text.strip()
                    ))
                return chunk_segments

            try:
                # Use as_completed to track progress
                futures = {self.executor.submit(process_chunk, chunk): chunk for chunk in chunks}
                from concurrent.futures import as_completed
                
                for future in as_completed(futures):
                    res = future.result()
                    all_segments.extend(res)
                    completed_chunks += 1
                    
                    # Progress from 20 to 90
                    if progress_callback:
                        progress = 20 + int((completed_chunks / total_chunks) * 70)
                        progress_callback(progress, f"Transcribed {completed_chunks}/{total_chunks} chunks")

            except Exception as e:
                logger.error(f"Chunk transcription failed: {e}")
                raise e
            finally:
                import shutil
                if chunk_dir.exists():
                    shutil.rmtree(chunk_dir, ignore_errors=True)
            
        else:
            # Short audio, direct transcribe
            logger.info(f"Short audio ({duration:.2f}s). Direct transcription.")
            if progress_callback: progress_callback(20, "Starting transcription...")
            
            segments, info = model.transcribe(
                audio_path, 
                beam_size=5, 
                language=language,
                vad_filter=True
            )
            all_segments = [
                SubtitleSegment(
                    id=0,
                    start=s.start,
                    end=s.end,
                    text=s.text.strip()
                ) for s in segments
            ]

        # 4. Final Processing
        if progress_callback: progress_callback(95, "Finalizing segments...")
        
        final_segments = []
        full_text_list = []
        for i, seg in enumerate(sorted(all_segments, key=lambda x: x.start)):
            seg.id = i + 1
            final_segments.append(seg)
            full_text_list.append(seg.text)
            
        logger.success(f"Transcription complete. Total segments: {len(final_segments)}")
        if progress_callback: progress_callback(100, "Completed")
        
        return TranscribeResponse(
            task_id=task_id or "sync_task",
            segments=final_segments,
            text="\n".join(full_text_list),
            language=language or "auto"
        )

asr_service = ASRService()
