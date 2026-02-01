import pytest
from unittest.mock import MagicMock, patch
from src.core.pipeline import PipelineRunner
from src.models.schemas import PipelineStepRequest, MediaAsset, TranscribeResponse, SubtitleSegment
from src.services.task_manager import task_manager

@pytest.mark.asyncio
async def test_pipeline_orchestration_flow():
    # 1. Mock Services
    with patch("src.services.downloader.downloader_service.download") as mock_download, \
         patch("src.services.asr.asr_service.transcribe") as mock_transcribe:
        
        # Setup Mock Returns
        mock_asset = MediaAsset(
            id="test_asset",
            filename="video.mp4",
            path="/tmp/video.mp4",
            duration=60.0,
            title="Test Video"
        )
        mock_download.return_value = mock_asset

        mock_transcribe_resp = TranscribeResponse(
            task_id="test_task",
            segments=[],
            text="Transcribed Text",
            language="en",
            srt_path="/tmp/video.srt"
        )
        mock_transcribe.return_value = mock_transcribe_resp

        # 2. Define Pipeline Steps
        steps = [
            PipelineStepRequest(step_name="download", params={"url": "http://example.com/video"}),
            PipelineStepRequest(step_name="transcribe", params={"model": "tiny"})
        ]

        # 3. Create Task (Real Task Manager)
        task_id = task_manager.create_task(
            task_type="pipeline",
            initial_message="Starting",
            task_name="Integration Test Pipeline"
        )

        # 4. Run Pipeline
        runner = PipelineRunner()
        result = await runner.run(steps, task_id=task_id)

        # 5. Verify Results
        assert result["status"] == "completed"
        assert result["history"] == ["download", "transcribe"]
        
        # Verify Context Sharing
        # The transcribe step should have picked up the path from the download step
        mock_download.assert_called_once()
        mock_transcribe.assert_called_once()
        
        # Check that transcribe was called with the path from mock_download
        call_args = mock_transcribe.call_args
        assert call_args.kwargs["audio_path"] == "/tmp/video.mp4"
        
        # Verify Task Manager Update
        final_task = task_manager.get_task(task_id)
        assert final_task.status == "completed"
        assert final_task.result["transcript"] == "Transcribed Text"
