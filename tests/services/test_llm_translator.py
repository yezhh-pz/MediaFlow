import pytest
from src.services.llm_translator import llm_translator
from src.models.schemas import SubtitleSegment

def test_translate_segments_empty():
    """Test translation with empty segments list."""
    assert llm_translator.translate_segments([], "zh") == []

def test_llm_translator_init():
    """Test LLM translator initialization."""
    from src.config import settings
    # This might vary based on ENV, but we check if it handles config
    assert hasattr(llm_translator, "model")
    assert llm_translator.model == settings.LLM_MODEL
