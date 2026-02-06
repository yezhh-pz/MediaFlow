from pathlib import Path
from typing import List
import re
from loguru import logger
from src.models.schemas import SubtitleSegment

class SubtitleManager:
    @staticmethod
    def process_vtt_file(vtt_path: Path) -> Path:
        """
        Process a VTT file downloaded by yt-dlp:
        1. Clean garbage metadata (X-word-ms)
        2. Convert to SRT
        Returns the path to the generated SRT file.
        """
        try:
            if not vtt_path.exists():
                return None

            logger.info(f"Processing subtitle file: {vtt_path.name}")
            # Use utf-8-sig to handle BOM if present
            content = vtt_path.read_text(encoding='utf-8-sig')
            
            # 1. Clean Metadata Tags
            cleaned_content = re.sub(r'<X-word-ms[^>]*>.*?</X-word-ms>\s*', '', content, flags=re.DOTALL)
            cleaned_content = re.sub(r'</?X-word-ms[^>]*>', '', cleaned_content)
            
            # 2. Convert to SRT
            srt_lines = []
            counter = 1
            
            # Normalize newlines
            lines = cleaned_content.replace('\r\n', '\n').split('\n')
            
            current_time_line = ""
            current_text = []
            
            # Pattern supports: HH:MM:SS.mmm or MM:SS.mmm
            timestamp_pattern = re.compile(r'(?:(\d{2}):)?(\d{2}):(\d{2})[\.,](\d{3})\s-->\s(?:(\d{2}):)?(\d{2}):(\d{2})[\.,](\d{3})')
            
            for line in lines:
                line = line.strip()
                if not line:
                    # Block finished?
                    if current_time_line and current_text:
                        srt_lines.append(str(counter))
                        srt_lines.append(current_time_line)
                        srt_lines.extend(current_text)
                        srt_lines.append("") # Empty line after block
                        counter += 1
                        current_time_line = ""
                        current_text = []
                    continue
                
                # Check if timestamp line
                match = timestamp_pattern.search(line)
                if match:
                    # Found a cue start
                    if current_time_line and current_text:
                        srt_lines.append(str(counter))
                        srt_lines.append(current_time_line)
                        srt_lines.extend(current_text)
                        srt_lines.append("")
                        counter += 1
                    
                    # Start new block, clear previous text
                    current_text = []
                    # Convert format: replace . with ,
                    current_time_line = line.replace('.', ',')
                else:
                    # Content line
                    if not current_time_line:
                        continue
                        
                    # Skip header/metadata digits
                    if line.isdigit() and not current_time_line:
                            continue
                    # Skip metadata lines or comments
                    if line.startswith('NOTE'):
                        continue
                        
                    current_text.append(line)

            # Flush last block
            if current_time_line and current_text:
                srt_lines.append(str(counter))
                srt_lines.append(current_time_line)
                srt_lines.extend(current_text)
                srt_lines.append("")

            # Write SRT file
            srt_path = vtt_path.with_suffix('.srt')
            srt_path.write_text('\n'.join(srt_lines), encoding='utf-8')
            logger.success(f"Converted to SRT: {srt_path.name}")
            return srt_path
            
        except Exception as e:
            logger.warning(f"Failed to process subtitles {vtt_path}: {e}")
            return None

    @staticmethod
    def format_timestamp(seconds: float) -> str:
        """Convert seconds to SRT timestamp format (HH:MM:SS,mmm)."""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = round((seconds - int(seconds)) * 1000)
        # Handle overflow from rounding up 999.5+
        if millis >= 1000:
            millis = 0
            secs += 1
            if secs >= 60:
                secs = 0
                minutes += 1
                if minutes >= 60:
                    minutes = 0
                    hours += 1
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    @staticmethod
    def save_srt(segments: List[SubtitleSegment], audio_path: str) -> str:
        """Generate and save SRT file next to the input audio."""
        srt_content = ""
        for i, seg in enumerate(segments):
            start_str = SubtitleManager.format_timestamp(seg.start)
            end_str = SubtitleManager.format_timestamp(seg.end)
            srt_content += f"{i + 1}\n{start_str} --> {end_str}\n{seg.text}\n\n"
            
        srt_path = Path(audio_path).with_suffix(".srt")
        try:
            with open(srt_path, "w", encoding="utf-8") as f:
                f.write(srt_content)
            return str(srt_path)
        except Exception as e:
            logger.error(f"Failed to save SRT file: {e}")
            return ""

    @staticmethod
    def refine_segments(segments, max_chars=50) -> List[SubtitleSegment]:
        """
        Refine segments using word-level timestamps to ensure subtitle-friendly length.
        """
        refined = []
        for seg in segments:
            # Handle case where 'words' attribute is missing (e.g. some models/configs)
            if not getattr(seg, 'words', None):
                text = seg.text.strip()
                if text:
                    refined.append(SubtitleSegment(
                        id="0", start=seg.start, end=seg.end, text=text
                    ))
                continue

            current_words = []
            current_len = 0
            current_start = seg.words[0].start
            
            for i, word in enumerate(seg.words):
                current_words.append(word)
                current_len += len(word.word)
                
                # Check Next Word (Lookahead)
                next_word = seg.words[i+1] if i + 1 < len(seg.words) else None
                
                is_end_of_sentence = word.word.strip()[-1] in ".!?。" if word.word.strip() else False
                is_too_long = current_len > max_chars
                is_last_word = (next_word is None)
                
                should_split = False
                
                if is_last_word:
                    should_split = True
                elif is_too_long:
                    should_split = True
                elif is_end_of_sentence:
                    should_split = True

                if should_split:
                    text = "".join([w.word for w in current_words]).strip()
                    if text:
                        seg_end = word.end
                        refined.append(SubtitleSegment(
                            id="0", 
                            start=current_start, 
                            end=seg_end, 
                            text=text
                        ))
                    
                    # Reset
                    current_words = []
                    current_len = 0
                    if next_word:
                        current_start = next_word.start
        
        # Post-Processing: Merge orphans
        final_refined = []
        if refined:
            final_refined.append(refined[0])
            for i in range(1, len(refined)):
                prev = final_refined[-1]
                curr = refined[i]
                
                curr_duration = curr.end - curr.start
                is_single_word = " " not in curr.text.strip()
                
                if is_single_word and (len(prev.text) + len(curr.text) < max_chars + 10):
                     # Merge!
                     prev.text += " " + curr.text
                     prev.end = curr.end
                else:
                    final_refined.append(curr)
                    
        return final_refined
