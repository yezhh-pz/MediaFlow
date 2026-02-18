"""
Service Registration — single place to import and register all services.

Extracted from main.py lifespan() (Issue #13) so that:
  1. main.py stays focused on app lifecycle (startup/shutdown).
  2. Service list is easy to scan and modify.
  3. Late imports that were scattered in main.py now live here.
"""

from backend.core.container import container, Services


def register_all_services():
    """Import and register every service in the DI container."""

    # ── Core ─────────────────────────────────────────────────
    from backend.services.task_manager import TaskManager
    from backend.core.ws_notifier import WebSocketNotifier
    from backend.core.pipeline import PipelineRunner

    container.register(Services.TASK_MANAGER, TaskManager)
    container.register(Services.WS_NOTIFIER, WebSocketNotifier)
    container.register(Services.PIPELINE, lambda: PipelineRunner(container.get(Services.TASK_MANAGER)))

    # ── Media ────────────────────────────────────────────────
    from backend.services.asr import ASRService
    from backend.services.downloader import DownloaderService
    from backend.services.video_synthesizer import VideoSynthesizer

    container.register(Services.ASR, ASRService)
    container.register(Services.DOWNLOADER, DownloaderService)
    container.register(Services.DOWNLOADER, DownloaderService)
    container.register(Services.VIDEO_SYNTHESIZER, VideoSynthesizer)

    from backend.services.enhancer import EnhancerService
    container.register(Services.ENHANCER, EnhancerService)

    from backend.services.cleaner import CleanerService
    container.register(Services.CLEANER, CleanerService)

    # ── External / Browser ───────────────────────────────────
    from backend.services.browser_service import BrowserService
    from backend.services.sniffer import NetworkSniffer
    from backend.services.analyzer import AnalyzerService
    from backend.services.cookie_manager import CookieManager

    container.register(Services.BROWSER, BrowserService)
    container.register(Services.SNIFFER, NetworkSniffer)
    container.register(Services.ANALYZER, AnalyzerService)
    container.register(Services.COOKIE_MANAGER, CookieManager)

    # ── AI / Translation ─────────────────────────────────────
    from backend.services.translator.llm_translator import LLMTranslator
    from backend.services.translator.glossary_service import GlossaryService
    from backend.services.settings_manager import SettingsManager

    container.register(Services.LLM_TRANSLATOR, LLMTranslator)
    container.register(Services.GLOSSARY, GlossaryService)
    container.register(Services.SETTINGS_MANAGER, SettingsManager)
