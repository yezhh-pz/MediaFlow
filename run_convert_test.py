import sys
import os
from pathlib import Path

# Add src to python path
sys.path.append(os.getcwd())

from src.services.downloader import downloader_service

def clean_manual():
    target_file = r"e:\Work\Code\Mediaflow\temp\Jon Hernandez - 📁 Sam Altman says that even though building software is now dramatica... [2016101057382825984].en.vtt"
    
    print(f"Targeting file: {target_file}")
    if not os.path.exists(target_file):
        print("Error: File not found!")
        return

    # Call the updated internal method
    downloader_service._clean_subtitles(target_file)
    print("Process finished.")

if __name__ == "__main__":
    clean_manual()
