from typing import List, Optional
from src.services.platforms.base import BasePlatform
from src.services.platforms.bilibili import BilibiliPlatform
from src.services.platforms.douyin import DouyinPlatform
from src.services.platforms.kuaishou import KuaishouPlatform

class PlatformFactory:
    _handlers: List[BasePlatform] = []

    @classmethod
    def register_handler(cls, handler: BasePlatform):
        cls._handlers.append(handler)

    @classmethod
    async def get_handler(cls, url: str) -> Optional[BasePlatform]:
        """Find the first handler that matches the URL."""
        # Initialize handlers if empty (Simple lazy init)
        if not cls._handlers:
            cls.register_handler(BilibiliPlatform())
            cls.register_handler(DouyinPlatform())
            cls.register_handler(KuaishouPlatform())

        url_str = str(url)  # Ensure url is a string (handles HttpUrl from Pydantic)
        for handler in cls._handlers:
            if await handler.match(url_str):
                return handler
        return None  # No specific handler found (caller should fallback to yt-dlp)
