from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from loguru import logger

from src.models.schemas import SubtitleSegment, TaskResponse, TaskResult, FileRef
from src.core.task_runner import BackgroundTaskRunner
from src.core.container import container, Services

router = APIRouter(prefix="/translate", tags=["Translator"])


def _get_task_manager():
    return container.get(Services.TASK_MANAGER)


def _get_llm_translator():
    return container.get(Services.LLM_TRANSLATOR)


class TranslateRequest(BaseModel):
    segments: List[SubtitleSegment]
    target_language: str = "Chinese"
    mode: str = "standard"  # standard, reflect
    context_path: Optional[str] = None  # Path to source file for reference/saving

class TranslateResponse(BaseModel):
    task_id: str
    status: str
    segments: Optional[List[SubtitleSegment]] = None

async def run_translation_task(task_id: str, req: TranslateRequest):
    """
    Background translation task.
    Uses BackgroundTaskRunner to eliminate boilerplate.
    """
    llm_translator = _get_llm_translator()
    
    # We need to define result_transformer that can save file if path exists
    def save_and_transform(segments):
        files = []
        meta = {
            "segments": [seg.dict() for seg in segments],
            "language": req.target_language
        }
        
        # If we have a context path, save the SRT
        if req.context_path and segments:
            try:
                from src.utils.subtitle_manager import SubtitleManager
                from pathlib import Path
                
                # Determine output path (e.g. original_CN.srt)
                suffix = f"_{req.target_language}"
                if req.target_language == "Chinese": suffix = "_CN"
                elif req.target_language == "English": suffix = "_EN"
                
                source_path = Path(req.context_path)
                stem = source_path.stem
                parent_dir = source_path.parent
                
                logger.debug(f"[Translate] Context Path: {req.context_path}")
                logger.debug(f"[Translate] Stem: {stem}, Suffix: {suffix}")
                
                # Emergency File Log
                with open("debug_translate.txt", "a", encoding="utf-8") as f:
                    f.write(f"\n--- New Task ---\n")
                    f.write(f"Context Path: {req.context_path}\n")
                    f.write(f"Stem: {stem}\n")
                    f.write(f"Suffix: {suffix}\n")
                    f.write(f"Proposed Save Path: {parent_dir / f'{stem}{suffix}'}\n")

                save_path = parent_dir / f"{stem}{suffix}" # save_srt appends .srt
                logger.debug(f"[Translate] Target Save Path: {save_path}.srt")
                
                # Save
                saved_path = SubtitleManager.save_srt(segments, str(save_path)) 
                
                files.append(FileRef(type="subtitle", path=str(saved_path), label="translation"))
                meta["srt_path"] = str(saved_path)
                
            except Exception as e:
                logger.error(f"Failed to save translated SRT: {e}")
        
        return TaskResult(
            success=True,
            files=files,
            meta=meta
        ).dict()

    await BackgroundTaskRunner.run(
        task_id=task_id,
        worker_fn=llm_translator.translate_segments,
        worker_kwargs={
            "segments": req.segments,
            "target_language": req.target_language,
            "mode": req.mode,
            "batch_size": 10
        },
        start_message="Starting translation...",
        success_message="Translation completed",
        result_transformer=save_and_transform,
    )


@router.post("/", response_model=TranslateResponse)
async def translate_subtitles(req: TranslateRequest, background_tasks: BackgroundTasks):
    """
    Submit a translation task.
    """
    try:
        # Extract filename from context_path if available
        from pathlib import Path
        source_name = "Subtitles"
        if req.context_path:
            source_name = Path(req.context_path).name

        task_id = await _get_task_manager().create_task(
            task_type="translate",
            initial_message="Queued",
            task_name=f"{source_name} ({req.target_language})",
            request_params={
                "mode": req.mode, 
                "count": len(req.segments),
                "context_path": req.context_path,
                "srt_path": req.context_path 
            }
        )
        
        background_tasks.add_task(run_translation_task, task_id, req)
        
        return TranslateResponse(task_id=task_id, status="pending")
        
    except Exception as e:
        logger.error(f"Failed to submit translation task: {e}")
        raise HTTPException(status_code=500, detail=str(e))
