import asyncio
from typing import Any, Dict, List
from loguru import logger
from src.services.downloader import downloader_service
from src.services.asr import asr_service
from src.services.task_manager import task_manager
from src.models.schemas import PipelineStepRequest

class PipelineContext:
    """Shared state passed between pipeline steps."""
    def __init__(self):
        self.data: Dict[str, Any] = {}
        self.history: List[str] = []

    def set(self, key: str, value: Any):
        self.data[key] = value

    def get(self, key: str, default=None):
        return self.data.get(key, default)

class PipelineRunner:
    async def run(self, steps: List[PipelineStepRequest], task_id: str = None) -> Dict[str, Any]:
        ctx = PipelineContext()
        logger.info(f"Starting pipeline with {len(steps)} steps. TaskID: {task_id}")

        if task_id:
            await task_manager.update_task(task_id, status="running", message="Starting pipeline...")

        for i, step in enumerate(steps):
            logger.info(f"Executing step {i+1}: {step.step_name}")
            
            # Check for cancellation before step
            if task_id and task_manager.is_cancelled(task_id):
                await task_manager.update_task(task_id, status="cancelled", message="Pipeline cancelled by user")
                raise Exception("Pipeline cancelled")

            try:
                if task_id:
                    await task_manager.update_task(task_id, message=f"Executing step: {step.step_name}")

                if step.step_name == "download":
                    await self._run_download(ctx, step.params, task_id)
                elif step.step_name == "transcribe":
                    await self._run_transcribe(ctx, step.params, task_id)
                else:
                    logger.warning(f"Unknown step: {step.step_name}")
                
                ctx.history.append(step.step_name)
            except Exception as e:
                logger.error(f"Pipeline failed at step {step.step_name}: {e}")
                if task_id:
                    if "cancelled" in str(e):
                        await task_manager.update_task(task_id, status="cancelled", message="Cancelled")
                    else:
                        await task_manager.update_task(task_id, status="failed", error=str(e), message=f"Failed at {step.step_name}")
                raise e
        
        # Determine final status
        if task_id:
            # Ensure data is serializable
            safe_data = {}
            for k, v in ctx.data.items():
                if hasattr(v, 'as_posix'): # Path objects
                    safe_data[k] = str(v)
                else:
                    safe_data[k] = v

            await task_manager.update_task(
                task_id, 
                status="completed", 
                progress=100.0, 
                message="Pipeline completed",
                result=safe_data 
            )

        return {
            "status": "completed", 
            "history": ctx.history,
            "final_data": ctx.data
        }

    async def _run_download(self, ctx: PipelineContext, params: dict, task_id: str = None):
        url = params.get("url")
        if not url:
            raise ValueError("Download step requires 'url' param")
        
        loop = asyncio.get_running_loop()
        
        # Callbacks for sync code
        def progress_cb(percent, msg):
            if task_id:
                asyncio.run_coroutine_threadsafe(
                    task_manager.update_task(task_id, progress=percent, message=msg),
                    loop
                )

        def check_cancel_cb():
            return task_id and task_manager.is_cancelled(task_id)

        # Run blocking download in thread pool
        asset = await loop.run_in_executor(
            None, 
            lambda: downloader_service.download(
                url, 
                proxy=params.get("proxy"),
                playlist_title=params.get("playlist_title"),
                progress_callback=progress_cb,
                check_cancel_callback=check_cancel_cb,
                download_subs=params.get("download_subs", False),
                resolution=params.get("resolution", "best"),
                task_id=task_id,
                cookie_file=params.get("cookie_file"),
                filename=params.get("filename")
            )
        )
        
        # Store result in context
        ctx.set("video_path", asset.path)
        ctx.set("media_filename", asset.filename)
        ctx.set("title", asset.title)
        logger.success(f"Step Download finished. Path: {asset.path}")

    async def _run_transcribe(self, ctx: PipelineContext, params: dict, task_id: str = None):
        # Try to get path from previous step or params
        audio_path = params.get("audio_path") or ctx.get("video_path")
        if not audio_path:
            raise ValueError("Transcribe step requires 'audio_path' (or result from download step)")
        
        model = params.get("model", "base")
        device = params.get("device", "cpu")
        
        # Also run transcribe in executor because it blocks!
        # Assuming asr_service.transcribe is synchronous/blocking
        
        loop = asyncio.get_running_loop()
        
        result = await loop.run_in_executor(
            None,
            lambda: asr_service.transcribe(
                audio_path=audio_path,
                model_name=model,
                device=device
            )
        )
        
        ctx.set("transcript", result.text)
        ctx.set("segments", result.segments)
        logger.success(f"Step Transcribe finished. Text len: {len(result.text)}")

pipeline_runner = PipelineRunner()
