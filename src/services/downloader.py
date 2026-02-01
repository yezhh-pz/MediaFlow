import yt_dlp
from pathlib import Path
from loguru import logger
import uuid
from src.config import settings
from src.models.schemas import MediaAsset
import re

def clean_ansi(text: str) -> str:
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    return ansi_escape.sub('', text)

class DownloaderService:
    def __init__(self):
        self.output_dir = settings.TEMP_DIR

    def download(self, url: str, proxy: str = None, playlist_title: str = None, 
                progress_callback=None, check_cancel_callback=None, download_subs: bool = False,
                resolution: str = "best", task_id: str = None, cookie_file: str = None,
                filename: str = None, local_source: str = None) -> MediaAsset:
        """
        Synchronous download using yt-dlp. 
        Should be run in a separate thread/executor to avoid blocking the event loop.
        """
        if playlist_title:
             # Sanitize playlist title to be safe for directory name
            safe_playlist_title = "".join([c for c in playlist_title if c.isalpha() or c.isdigit() or c in ' -_[]']).rstrip()
            target_dir = self.output_dir / safe_playlist_title
            target_dir.mkdir(parents=True, exist_ok=True)
            if filename:
                 # Use provided filename but still in playlist folder
                 safe_name = "".join([c for c in filename if c.isalpha() or c.isdigit() or c in ' -_[]().']).rstrip()
                 output_template = str(target_dir / f"{safe_name}.%(ext)s")
            else:
                 output_template = str(target_dir / "%(title)s [%(id)s].%(ext)s")
        else:
            if filename:
                 safe_name = "".join([c for c in filename if c.isalpha() or c.isdigit() or c in ' -_[]().']).rstrip()
                 output_template = str(self.output_dir / f"{safe_name}.%(ext)s")
            else:
                output_template = str(self.output_dir / "%(title)s [%(id)s].%(ext)s")
        
        # Bypass download if we have a local source (Electron direct download)
        if local_source:
            local_source = Path(local_source)
            if local_source.exists():
                # Manually construct filename since we don't have yt-dlp info dict yet
                # Ensure safe_name is defined even if not provided in kwargs
                safe_name_local = safe_name if 'safe_name' in locals() else "".join([c for c in (filename or f"Douyin_Video_{int(time.time())}") if c.isalpha() or c.isdigit() or c in ' -_[]().']).rstrip()
                
                final_stem = safe_name_local
                final_path = Path(output_template.replace("%(title)s", "Douyin_Video").replace("%(id)s", "Direct").replace("%(ext)s", "mp4"))
                
                # If template had wildcards, we need a concrete path. 
                # Simpler approach: Use target_dir / filename
                dest_dir = Path(output_template).parent
                dest_path = dest_dir / f"{final_stem}.mp4"
                
                logger.info(f"Moving local file {local_source} to {dest_path}")
                import shutil
                shutil.move(str(local_source), str(dest_path))
                
                return MediaAsset(
                    id=task_id or str(uuid.uuid4()),
                    title=filename or "Douyin Direct Video",
                    video_path=str(dest_path),
                    duration=0, # Unknown without probing
                    source_url=url
                )

        # Check for local ffmpeg in bin/ folder
        ffmpeg_exe = settings.BIN_DIR / "ffmpeg.exe"
        ffmpeg_location = str(ffmpeg_exe) if ffmpeg_exe.exists() else settings.FFMPEG_PATH
        
        # Map resolution to format
        format_map = {
            "best": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4",
            "4k": "bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/mp4",
            "2k": "bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/mp4",
            "1080p": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/mp4",
            "720p": "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/mp4",
            "480p": "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/mp4",
            "audio": "bestaudio/best"
        }
        selected_format = format_map.get(resolution, format_map["best"])

        ydl_opts = {
            'format': selected_format,
            'outtmpl': output_template,
            'quiet': True,
            'no_warnings': True,
            'proxy': proxy,
            'ffmpeg_location': ffmpeg_location,
            'cookiefile': cookie_file,  # Add cookie file support
            # Match Browser User-Agent to ensure cookies work
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'progress_hooks': [
                lambda d: self._progress_hook(d, progress_callback, check_cancel_callback)
            ],
            # Subtitle options
            'writesubtitles': download_subs,
            'writeautomaticsub': download_subs,
            'subtitleslangs': ['en', 'zh'] if download_subs else [],
            # Smart completion options
            'nooverwrites': True,
            'continuedl': True,
            'ignoreerrors': True, # Skip failed videos in playlist
            # Referer is also important for Douyin
            'referer': 'https://www.douyin.com/',
        }

        logger.info(f"Starting download: {url}")
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if not info:
                raise Exception("Download failed, cancelled, or no info returned")
            filename = ydl.prepare_filename(info)
            
            # Retrieve actual duration/title
            duration = info.get('duration')
            title = info.get('title')
            
            # Post-processing: Clean subtitles if requested
            if download_subs:
                self._clean_subtitles(filename)

            logger.success(f"Download complete: {filename}")
            
            return MediaAsset(
                id=task_id or str(uuid.uuid4()),
                filename=Path(filename).name,
                path=filename,
                duration=duration,
                title=title
            )

    def _clean_subtitles(self, video_path: str):
        """
        Process subtitles:
        1. Clean garbage X/Twitter metadata
        2. Convert VTT to SRT (add sequence numbers, fix timestamps)
        """
        try:
            path_obj = Path(video_path)
            
            if path_obj.suffix.lower() == '.vtt':
                candidates = [path_obj]
            else:
                directory = path_obj.parent
                stem = path_obj.stem
                candidates = [
                    p for p in directory.glob("*.vtt") 
                    if p.name.startswith(stem)
                ]

            for vtt_file in candidates:
                if not vtt_file.exists():
                     continue

                logger.info(f"Processing subtitle file: {vtt_file.name}")
                # Use utf-8-sig to handle BOM if present
                content = vtt_file.read_text(encoding='utf-8-sig')
                
                # 1. Clean Metadata Tags
                # Remove <X-word-ms> tags first
                cleaned_content = re.sub(r'<X-word-ms[^>]*>.*?</X-word-ms>\s*', '', content, flags=re.DOTALL)
                cleaned_content = re.sub(r'</?X-word-ms[^>]*>', '', cleaned_content)
                
                # 2. Convert to SRT
                srt_lines = []
                counter = 1
                
                # Normalize newlines
                lines = cleaned_content.replace('\r\n', '\n').split('\n')
                
                current_time_line = ""
                current_text = []
                
                # Pattern supports: 
                # HH:MM:SS.mmm (00:01:02.000)
                # MM:SS.mmm (01:02.000)
                timestamp_pattern = re.compile(r'(?:(\d{2}):)?(\d{2}):(\d{2})[\.,](\d{3})\s-->\s(?:(\d{2}):)?(\d{2}):(\d{2})[\.,](\d{3})')
                
                for line in lines:
                    line = line.strip()
                    if not line:
                        # Block finished?
                        if current_time_line and current_text:
                            # Write SRT block
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
                        # Critical Fix: Ignore text if we haven't seen a timestamp yet (skips WEBVTT header and metadata)
                        if not current_time_line:
                            continue
                            
                        # Logic Change: Only skip digits if they appear BEFORE the timestamp (header indices)
                        # and NOT after the timestamp (actual content).
                        # In VTT to SRT conversion, sequence numbers are handled by 'counter'.
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
                srt_path = vtt_file.with_suffix('.srt')
                srt_path.write_text('\n'.join(srt_lines), encoding='utf-8')
                logger.success(f"Converted to SRT: {srt_path.name}")
                
                # Optional: Overwrite VTT with cleaned content too, in case they prefer VTT?
                # User asked for SRT conversion, so SRT is the priority.
                # vtt_file.write_text(cleaned_content, encoding='utf-8') 

        except Exception as e:
            logger.warning(f"Failed to process subtitles: {e}")

    def _progress_hook(self, d, progress_callback, check_cancel_callback):
        # 1. Check for cancellation
        if check_cancel_callback and check_cancel_callback():
            raise Exception("Download cancelled by user")

        # 2. Update progress
        if d['status'] == 'downloading':
            try:
                # Extract percentage
                raw_percent = d.get('_percent_str', '0%')
                clean_percent = clean_ansi(raw_percent).replace('%','')
                percent = float(clean_percent) if clean_percent != 'N/A' else 0.0
                
                if progress_callback:
                    progress_callback(percent, f"Downloading: {clean_ansi(d.get('_percent_str'))} - {clean_ansi(d.get('_eta_str'))} left")
            except Exception as e:
                logger.warning(f"Error in progress hook: {e}")
                
        elif d['status'] == 'finished':
            if progress_callback:
                progress_callback(100.0, "Processing completed")

downloader_service = DownloaderService()
