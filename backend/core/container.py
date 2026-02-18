"""
Service Container - Lightweight dependency injection for MediaFlow.
Provides centralized service registration and lazy instantiation.
"""
from typing import Dict, Any, Callable, TypeVar
from loguru import logger

T = TypeVar('T')


class ServiceContainer:
    """
    Lightweight dependency injection container.
    
    Features:
    - Lazy instantiation (services created on first access)
    - Singleton lifecycle (one instance per service)
    - Override support for testing
    
    Usage:
        container.register("task_manager", TaskManager)
        tm = container.get("task_manager")  # Creates instance on first call
    """
    
    def __init__(self):
        self._factories: Dict[str, Callable[[], Any]] = {}
        self._instances: Dict[str, Any] = {}
    
    def register(self, name: str, factory: Callable[[], T]) -> None:
        """
        Register a service factory function.
        
        Args:
            name: Service identifier (e.g., "task_manager")
            factory: Callable that creates the service instance
        """
        self._factories[name] = factory
        logger.debug(f"[Container] Registered service: {name}")
    
    def get(self, name: str) -> Any:
        """
        Get or create a service instance (singleton pattern).
        
        Args:
            name: Service identifier
            
        Returns:
            The service instance
            
        Raises:
            KeyError: If service not registered
        """
        if name not in self._instances:
            if name not in self._factories:
                raise KeyError(f"Service '{name}' not registered. "
                             f"Available: {list(self._factories.keys())}")
            self._instances[name] = self._factories[name]()
            logger.debug(f"[Container] Instantiated service: {name}")
        return self._instances[name]
    
    def has(self, name: str) -> bool:
        """Check if a service is registered."""
        return name in self._factories
    
    def reset(self) -> None:
        """
        Reset all instances (for testing or shutdown).
        Factories remain registered.
        """
        self._instances.clear()
        logger.debug("[Container] All service instances cleared")
    
    def override(self, name: str, instance: Any) -> None:
        """
        Override a service with a custom instance (for testing/mocking).
        
        Args:
            name: Service identifier
            instance: The mock/custom instance to use
        """
        self._instances[name] = instance
        logger.debug(f"[Container] Overrode service: {name}")


# Global container instance
container = ServiceContainer()


# Service name constants (prevents typos)
class Services:
    TASK_MANAGER = "task_manager"
    WS_NOTIFIER = "ws_notifier"
    ASR = "asr"
    DOWNLOADER = "downloader"
    LLM_TRANSLATOR = "llm_translator"
    BROWSER = "browser"
    SNIFFER = "sniffer"
    SETTINGS_MANAGER = "settings_manager"
    GLOSSARY = "glossary"
    COOKIE_MANAGER = "cookie_manager"
    ANALYZER = "analyzer"
    PIPELINE = "pipeline"
    VIDEO_SYNTHESIZER = "video_synthesizer"
    ENHANCER = "enhancer"
    CLEANER = "cleaner"


# ─── Typed Accessors ─────────────────────────────────────────────
# Optional convenience wrappers: return correct types for IDE support.
# The TYPE_CHECKING imports are erased at runtime → no circular imports.

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.services.task_manager import TaskManager
    from backend.core.ws_notifier import WebSocketNotifier
    from backend.services.asr import ASRService
    from backend.services.downloader import DownloaderService
    from backend.services.settings_manager import SettingsManager
    from backend.services.video_synthesizer import VideoSynthesizer
    from backend.core.pipeline import PipelineRunner
    from backend.services.enhancer import RealESRGANService
    from backend.services.cleaner import CleanerService


def get_task_manager() -> "TaskManager":
    return container.get(Services.TASK_MANAGER)

def get_ws_notifier() -> "WebSocketNotifier":
    return container.get(Services.WS_NOTIFIER)

def get_asr() -> "ASRService":
    return container.get(Services.ASR)

def get_downloader() -> "DownloaderService":
    return container.get(Services.DOWNLOADER)

def get_settings_manager() -> "SettingsManager":
    return container.get(Services.SETTINGS_MANAGER)

def get_video_synthesizer() -> "VideoSynthesizer":
    return container.get(Services.VIDEO_SYNTHESIZER)

def get_pipeline() -> "PipelineRunner":
    return container.get(Services.PIPELINE)

def get_enhancer() -> "RealESRGANService":
    return container.get(Services.ENHANCER)

def get_cleaner() -> "CleanerService":
    return container.get(Services.CLEANER)
