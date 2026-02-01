import pytest
from fastapi.testclient import TestClient
from src.main import app
from src.services.asr import asr_service
from src.services.downloader import downloader_service
from src.services.llm_translator import llm_translator

@pytest.fixture
def client():
    """FastAPI test client fixture."""
    return TestClient(app)

@pytest.fixture
def mock_asr(mocker):
    """Mock for ASRService."""
    return mocker.patch("src.services.asr.asr_service")

@pytest.fixture
def mock_downloader(mocker):
    """Mock for DownloaderService."""
    return mocker.patch("src.services.downloader.downloader_service")

@pytest.fixture
def mock_llm(mocker):
    """Mock for LLMTranslator."""
    return mocker.patch("src.services.llm_translator.llm_translator")
