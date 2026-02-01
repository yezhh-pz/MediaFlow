import pytest
from unittest.mock import MagicMock, patch
from src.services.asr import ASRService
from src.utils.subtitle_manager import SubtitleManager
from src.utils.audio_processor import AudioProcessor

@pytest.fixture
def asr_service():
    return ASRService()

def test_format_timestamp():
    # Test moved to SubtitleManager
    assert SubtitleManager.format_timestamp(0) == "00:00:00,000"
    assert SubtitleManager.format_timestamp(61.5) == "00:01:01,500"
    assert SubtitleManager.format_timestamp(3661.001) == "01:01:01,001"

def test_calculate_split_points():
    # Test moved to AudioProcessor
    total_duration = 3000
    silence_intervals = [(590, 610), (1200, 1220), (1800, 1820)]
    
    # Target chunk duration = 600
    points = AudioProcessor.calculate_split_points(total_duration, silence_intervals, target_chunk_duration=600)
    
    assert len(points) >= 4
    # Points should be roughly at 600, 1200, 1800, 2400...
    # Based on silence intervals, first point should be around 600 (middle of 590-610 is 600)
    assert abs(points[0] - 600) < 1.0

def test_asr_service_singleton(asr_service):
    service2 = ASRService()
    assert asr_service is service2
