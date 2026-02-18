"""
Path validation utility to prevent path traversal attacks.

All API endpoints that accept file paths from the client should call
validate_path() before performing any I/O operations.
"""
from pathlib import Path
from loguru import logger
from backend.config import settings


def validate_path(user_path: str, label: str = "path") -> Path:
    """
    Resolve a user-supplied path and verify it falls within allowed directories.

    Raises ValueError if the path is outside all allowed roots.
    Returns the resolved Path on success.
    """
    resolved = Path(user_path).resolve()
    allowed_roots = [
        Path(settings.WORKSPACE_DIR).resolve(),
        Path(settings.OUTPUT_DIR).resolve(),
        Path(settings.USER_DATA_DIR).resolve(),
        Path(settings.TEMP_DIR).resolve(),
    ]
    if not any(resolved.is_relative_to(root) for root in allowed_roots):
        logger.warning(f"Path validation failed for {label}: {resolved}")
        raise ValueError(f"Path not within allowed directories: {resolved}")
    return resolved
