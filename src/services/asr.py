import os
import shutil
import asyncio
from pathlib import Path
from typing import List, Optional, TYPE_CHECKING
from concurrent.futures import ThreadPoolExecutor

if TYPE_CHECKING:
    from faster_whisper import WhisperModel

from loguru import logger

from src.config import settings
from src.models.schemas import SubtitleSegment, TranscribeResponse
from src.utils.audio_processor import AudioProcessor
from src.utils.subtitle_manager import SubtitleManager

class ASRService:
    _instance = None
    _model_instance = None
    _current_model_name = None

    def __new__(cls):
        """Singleton pattern ensuring only one service instance exists."""
        if cls._instance is None:
            cls._instance = super(ASRService, cls).__new__(cls)
            cls._instance.executor = ThreadPoolExecutor(max_workers=settings.ASR_MAX_WORKERS)
        return cls._instance

    def _ensure_model_downloaded(self, model_name: str, progress_callback=None) -> str:
        """
        Ensure the model is downloaded to local storage, supporting ModelScope.
        Returns the local path to the model.
        """
        settings.MODEL_DIR.mkdir(parents=True, exist_ok=True)
        
        model_map = {
            "tiny": "pengzhendong/faster-whisper-tiny",
            "base": "pengzhendong/faster-whisper-base",
            "small": "pengzhendong/faster-whisper-small",
            "medium": "pengzhendong/faster-whisper-medium",
            "large-v1": "pengzhendong/faster-whisper-large-v1",
            "large-v2": "pengzhendong/faster-whisper-large-v2",
            "large-v3": "pengzhendong/faster-whisper-large-v3",
            "large-v3-turbo": "pengzhendong/faster-whisper-large-v3-turbo",
        }
        
        model_repo_id = model_map.get(model_name, model_name)
        # CLI expects "faster-whisper-{model_name}" folder structure
        target_dir = settings.MODEL_DIR / "faster-whisper" / f"faster-whisper-{model_name}"
        
        # If model exists and is not empty, return path
        if target_dir.exists() and any(target_dir.iterdir()):
             return str(target_dir)

        # Download Logic
        try:
            from modelscope.hub.snapshot_download import snapshot_download
            logger.info(f"Attempting download from ModelScope: {model_repo_id}")
            if progress_callback: progress_callback(0, f"Downloading model {model_name} from ModelScope...")
            
            local_model_path = snapshot_download(
                model_repo_id, 
                local_dir=str(target_dir) 
            )
            logger.success(f"Model downloaded to: {local_model_path}")
            if progress_callback: progress_callback(5, "Model downloaded.")
            return local_model_path
            
        except ImportError:
            logger.warning("ModelScope not installed, falling back to default (HuggingFace)...")
            if progress_callback: progress_callback(2, "ModelScope missing. Downloading from HuggingFace...")
            return model_name 
        except Exception as e:
            logger.error(f"ModelScope download failed: {e}. Falling back to default...")
            if progress_callback: progress_callback(2, f"Download failed, retrying... ({str(e)[:20]})")
            return model_name

    def _load_model(self, model_name: str, device: str, progress_callback=None):
        """
        Load or reload the Whisper model securely from the local models directory.
        """
        if self._model_instance and self._current_model_name == model_name:
            return self._model_instance
            
        logger.info(f"Loading Whisper Model: {model_name} on {device}...")
        
        # Lazy import to speed up app startup
        from faster_whisper import WhisperModel
        
        try:
            compute_type = "float16" if device == "cuda" else "int8"
            
            # Ensure model is downloaded (via ModelScope if possible)
            local_model_path = self._ensure_model_downloaded(model_name, progress_callback)
            
            # Load model
            if progress_callback: progress_callback(8, f"Initializing {model_name} on {device}...")
            self._model_instance = WhisperModel(
                local_model_path,
                device=device,
                compute_type=compute_type,
                download_root=str(settings.MODEL_DIR) if local_model_path == model_name else None
            )
            self._current_model_name = model_name
            logger.success(f"Model {model_name} loaded successfully.")
            if progress_callback: progress_callback(10, "Model loaded successfully.")
            return self._model_instance
            
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            raise RuntimeError(f"Model loading failed: {e}")

    def _transcribe_with_cli(self, audio_path: str, model_name: str, language: str, initial_prompt: str, progress_callback) -> List[SubtitleSegment]:
        """
        Use Independent Faster-Whisper-XXL CLI for transcription.
        Supports advanced segmentation features (--sentence).
        """
        import subprocess
        import re
        import time
        
        if not Path(settings.FASTER_WHISPER_CLI_PATH).exists():
            raise FileNotFoundError(f"Faster Whisper CLI not found at: {settings.FASTER_WHISPER_CLI_PATH}")
            
        logger.info(f"Using Faster-Whisper-XXL CLI: {settings.FASTER_WHISPER_CLI_PATH}")
        
        # Temp output directory
        output_dir = settings.TEMP_DIR / f"cli_out_{Path(audio_path).stem}_{int(time.time())}"
        output_dir.mkdir(parents=True, exist_ok=True)

        # Ensure model is downloaded first (supports ModelScope)
        local_model_path = self._ensure_model_downloaded(model_name, progress_callback)
        
        # Check if local model path is valid
        if Path(local_model_path).exists():
            # For VideoCaptioner compatibility, we should use the model name relative to model_dir if possible
            # But local_model_path from snapshot_download is absolute.
            # If we pass absolute path to --model, --model_dir might be ignored.
            # However, if we pass model name, we need to ensure it's in model_dir.
            # modelscope downloads to model_dir/model_name usually.
            
            # Let's try to use the folder name if it's within model_dir
            # Let's try to use the folder name if it's within model_dir
            # CLI automatically prepends "faster-whisper-" to the model arg if not already present?
            # Log shows: "Model not found at ... faster-whisper-faster-whisper-large-v3"
            # This means if we pass "faster-whisper-large-v3", it looks for "faster-whisper-faster-whisper-large-v3"
            # So we should pass "large-v3" and ensure folder is "faster-whisper-large-v3"
            
            # We already fixed the folder name to be "faster-whisper-large-v3".
            # So here we must pass "large-v3".
            cli_model = model_name
            if "large-v3" in model_name: cli_model = "large-v3"
            elif "large-v2" in model_name: cli_model = "large-v2"
            elif "medium" in model_name: cli_model = "medium"
            elif "small" in model_name: cli_model = "small"
            elif "base" in model_name: cli_model = "base"
            elif "tiny" in model_name: cli_model = "tiny"
        else:
            # Fallback
            cli_model = model_name
            if "large-v3" in model_name: cli_model = "large-v3"
            elif "large-v2" in model_name: cli_model = "large-v2"
            elif "medium" in model_name: cli_model = "medium"
            elif "small" in model_name: cli_model = "small"
            elif "base" in model_name: cli_model = "base"
            elif "tiny" in model_name: cli_model = "tiny"
        
        # Language specific settings (VideoCaptioner logic)
        is_cjk = language in ["zh", "ja", "ko", "zh-CN"]
        max_line_width = "30" if is_cjk else "50"  # Reduced from 90 to 50 for natural subtitles
        
        cmd = [
            settings.FASTER_WHISPER_CLI_PATH,
            str(audio_path),
            "--model", str(cli_model),
            "-o", str(output_dir),
            "--output_format", "srt",
            "--print_progress",
            
            # Key features for better segmentation
            "--vad_filter", "true",
            "--sentence", 
            "--max_line_width", max_line_width,
            "--max_line_count", "1",
            "--max_comma", "20",
            "--max_comma_cent", "50"
        ]
        
        if language and language != "auto":
            cmd.extend(["--language", language])
        
        if initial_prompt:
             cmd.extend(["--initial_prompt", initial_prompt])
             
        # Use existing model dir
        cli_model_dir = settings.MODEL_DIR / "faster-whisper"
        cli_model_dir.mkdir(parents=True, exist_ok=True)
        cmd.extend(["--model_dir", str(cli_model_dir)])
        
        logger.info(f"CLI Command: {' '.join(cmd)}")
        if progress_callback: progress_callback(10, "Starting Faster-Whisper CLI processing...")
        
        try:
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='replace',
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            
            while True:
                line = process.stdout.readline()
                if not line and process.poll() is not None:
                    break
                if line:
                    line = line.strip()
                    # Parse progress
                    if match := re.search(r"(\d+)%", line):
                        p = int(match.group(1))
                        # Only update if it looks like transcription progress (usually distinct from download %)
                        # Download progress usually has file sizes like "1.14MB"
                        if "MB" not in line and "kB" not in line: 
                            if progress_callback: 
                                progress_callback(10 + int(p * 0.8), f"Transcribing... {p}%")
                    
                    # Log only interesting lines, skip progress bars and download noise
                    if not any(x in line for x in ["model.bin", ".json", "MB/s", "kB/s", "it/s"]) and line.strip():
                        logger.debug(f"CLI: {line}")
            
            if process.returncode != 0:
                raise RuntimeError(f"CLI process failed with code {process.returncode}")
                
            # Find output SRT
            srt_files = list(output_dir.glob("*.srt"))
            if not srt_files:
                raise RuntimeError("No SRT output generated by CLI")
            
            srt_path = srt_files[0]
            content = srt_path.read_text(encoding='utf-8')
            segments = SubtitleManager.parse_srt(content)
            
            return segments
            
        finally:
            # Cleanup
            try:
                if output_dir.exists():
                    shutil.rmtree(output_dir, ignore_errors=True)
            except Exception as e:
                logger.warning(f"Failed to clean up temp dir {output_dir}: {e}")

    def transcribe(self, audio_path: str, model_name: str = "base", device: str = "cpu", language: str = None, task_id: str = None, initial_prompt: str = None, progress_callback=None) -> TranscribeResponse:
        """
        Main entry point for transcription. Dispatches to specific strategies.
        """
        if not os.path.exists(audio_path):
            logger.error(f"Audio file not found: {audio_path}")
            raise FileNotFoundError(f"File not found: {audio_path}")

        if not initial_prompt:
             initial_prompt = "Hello, Welcome. This is a subtitle for the video." if not language or language == "en" else "你好，欢迎。这是一个视频字幕。"

        # Check for CLI tool
        use_cli = False
        if hasattr(settings, 'FASTER_WHISPER_CLI_PATH') and Path(settings.FASTER_WHISPER_CLI_PATH).exists():
            use_cli = True
            logger.info("Faster-Whisper CLI found. Using CLI for best segmentation results.")
        
        final_segments = []
        
        if use_cli:
            try:
                final_segments = self._transcribe_with_cli(
                    audio_path, model_name, language, initial_prompt, progress_callback
                )
            except Exception as e:
                logger.error(f"CLI Transcription failed: {e}. Falling back to internal engine.")
                use_cli = False # Fallback
                
        if not use_cli:
            # 1. Load Model
            model = self._load_model(model_name, device, progress_callback)
            
            # 2. Analyze Audio
            duration = AudioProcessor.get_audio_duration(audio_path)
            logger.info(f"Audio Duration: {duration:.2f}s")
            
            # 3. Strategy Decision
            if duration > 900: 
                all_segments = self._transcribe_smart_split(
                    audio_path, duration, model, language, initial_prompt, progress_callback
                )
            else:
                all_segments = self._transcribe_direct(
                    audio_path, duration, model, language, initial_prompt, progress_callback
                )
            
            # 4. Final Processing
            if progress_callback: progress_callback(95, "Finalizing segments...")
            final_segments, _ = self._merge_segments(all_segments)

        # Apply Smart Merge (Fix V2 over-segmentation)
        # This merges short fragments like "three times." into previous sentences
        logger.info("Applying smart segment merging...")
        final_segments = SubtitleManager.merge_segments(final_segments)

        # Generate full text
        full_text = "\n".join([s.text for s in final_segments])
            
        logger.success(f"Transcription complete. Total segments: {len(final_segments)}")
        if progress_callback: progress_callback(100, "Completed")
        
        # 5. Save SRT file
        srt_path = SubtitleManager.save_srt(final_segments, audio_path)
        logger.success(f"SRT file saved to: {srt_path}")
        
        return TranscribeResponse(
            task_id=task_id or "sync_task",
            segments=final_segments,
            text=full_text,
            language=language or "auto",
            srt_path=srt_path
        )

    def _transcribe_direct(self, audio_path: str, duration: float, model: "WhisperModel", language: str, initial_prompt: str, progress_callback) -> List[SubtitleSegment]:
        """Handle short audio files directly."""
        logger.info(f"Short audio ({duration:.2f}s). Direct transcription.")
        if progress_callback: progress_callback(20, "Starting transcription...")
        
        segments_gen, info = model.transcribe(
            audio_path, 
            beam_size=5, 
            language=language,
            vad_filter=True,
            initial_prompt=initial_prompt,
            word_timestamps=True,
            condition_on_previous_text=False
        )
        
        segments_list = list(segments_gen)
        return SubtitleManager.refine_segments(segments_list, max_chars=50)

    def _transcribe_smart_split(self, audio_path: str, duration: float, model: "WhisperModel", language: str, initial_prompt: str, progress_callback) -> List[SubtitleSegment]:
        """Handle long audio files by splitting them based on silence."""
        logger.info("Long audio detected. Using VAD Smart Splitting strategy.")
        if progress_callback: progress_callback(10, "Splitting audio...")

        silence_intervals = AudioProcessor.detect_silence(audio_path)
        split_points = AudioProcessor.calculate_split_points(duration, silence_intervals)
        logger.info(f"Calculated {len(split_points)} split points: {[f'{p:.1f}s' for p in split_points]}")
        
        chunk_dir = settings.TEMP_DIR / f"chunks_{Path(audio_path).stem}"
        chunk_dir.mkdir(parents=True, exist_ok=True)
        
        chunks = AudioProcessor.split_audio_physically(audio_path, split_points, chunk_dir)
        logger.info(f"Split into {len(chunks)} physical chunks.")
        
        if progress_callback: progress_callback(20, f"Split into {len(chunks)} chunks. Starting transcription...")

        all_segments = []
        total_chunks = len(chunks)
        completed_chunks = 0
        
        try:
            # Create a localized function for pickle compatibility not required here since threads share memory
            # But direct method reference is cleaner.
            futures = {}
            for chunk in chunks:
                # We submit the _process_chunk method
                future = self.executor.submit(
                    self._process_chunk, 
                    chunk, model, language, initial_prompt
                )
                futures[future] = chunk

            from concurrent.futures import as_completed
            
            for future in as_completed(futures):
                res = future.result()
                all_segments.extend(res)
                completed_chunks += 1
                
                if progress_callback:
                    progress = 20 + int((completed_chunks / total_chunks) * 70)
                    progress_callback(progress, f"Transcribed {completed_chunks}/{total_chunks} chunks")

        except Exception as e:
            logger.error(f"Chunk transcription failed: {e}")
            raise e
        finally:
            if chunk_dir.exists():
                shutil.rmtree(chunk_dir, ignore_errors=True)
        
        return all_segments

    def _process_chunk(self, chunk_info, model: "WhisperModel", language: str, initial_prompt: str) -> List[SubtitleSegment]:
        """Process a single audio chunk."""
        c_path, c_offset = chunk_info
        logger.info(f"Transcribing chunk starting at {c_offset:.1f}s...")
        segs, _ = model.transcribe(
            c_path, 
            beam_size=5, 
            language=language, 
            vad_filter=True,
            initial_prompt=initial_prompt,
            word_timestamps=True 
        )
        
        # Convert generator to list
        segs_list = list(segs)
        
        # Refine relative to chunk
        refined_local = SubtitleManager.refine_segments(segs_list, max_chars=50)
        
        # Apply Offset
        chunk_segments = []
        for s in refined_local:
            s.start += c_offset
            s.end += c_offset
            chunk_segments.append(s)
            
        return chunk_segments

    def _merge_segments(self, all_segments: List[SubtitleSegment]):
        """Merge and sort segments from multiple chunks."""
        final_segments_list = []
        if all_segments:
             all_segments.sort(key=lambda x: x.start)
             final_segments_list.append(all_segments[0])
             for i in range(1, len(all_segments)):
                  prev = final_segments_list[-1]
                  curr = all_segments[i]
                  
                  is_single_word = " " not in curr.text.strip()
                  is_close = (curr.start - prev.end) < 0.5
                  
                  if is_single_word and is_close and (len(prev.text) + len(curr.text) < 60):
                       prev.text += " " + curr.text
                       prev.end = curr.end
                  else:
                       final_segments_list.append(curr)
        
        # Re-index
        final_segments = []
        full_text_list = []
        for i, seg in enumerate(final_segments_list):
            seg.id = str(i + 1)
            final_segments.append(seg)
            full_text_list.append(seg.text)
            
        return final_segments, "\n".join(full_text_list)


