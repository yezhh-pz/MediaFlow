
import os
import sys

# Add src to path
sys.path.append(os.getcwd())

from backend.services.enhancer import RealESRGANService
from loguru import logger

def run():
    # 1. Create a dummy test video
    test_video = "test_input.mp4"
    # We can rely on existing one or create new
    if not os.path.exists(test_video):
        print("Creating dummy video...")
        import subprocess
        ffmpeg_path = r"E:\Work\Code\Mediaflow\bin\ffmpeg.exe"
        subprocess.run([ffmpeg_path, "-f", "lavfi", "-i", "color=c=red:s=320x240:d=1", "-c:v", "libx264", test_video], check=True)

    output_video = "test_output.mp4"
    if os.path.exists(output_video):
        os.remove(output_video)
        
    print("Running RealESRGANService...")
    service = RealESRGANService()
    
    def progress(p, msg):
        print(f"Progress: {p}% - {msg}")

    try:
        service.upscale(test_video, output_video, progress_callback=progress)
        print("Success!", output_video)
    except Exception as e:
        print("Error:", e)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run()
