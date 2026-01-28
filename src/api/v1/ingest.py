from fastapi import APIRouter, HTTPException, BackgroundTasks
from src.models.schemas import DownloadRequest, MediaAsset
from src.services.downloader import downloader_service
from loguru import logger

router = APIRouter(prefix="/ingest", tags=["Ingestion"])

@router.post("/download", response_model=MediaAsset, deprecated=True)
async def download_video(req: DownloadRequest):
    """
    [DEPRECATED] Synchronous download endpoint for testing only.
    
    For production use, please use /pipeline/run which executes downloads
    in background tasks with progress tracking via WebSocket.
    """
    logger.warning("[ingest] Using deprecated synchronous download endpoint")
    try:
        result = downloader_service.download(str(req.url), req.proxy)
        return result
    except Exception as e:
        logger.error(f"Download failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

