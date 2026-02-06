from src.core.steps.registry import StepRegistry
from src.core.steps.download import DownloadStep
from src.core.steps.transcribe import TranscribeStep

# This ensures they are registered
__all__ = ["StepRegistry"]
