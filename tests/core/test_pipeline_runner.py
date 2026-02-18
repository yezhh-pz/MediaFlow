import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.core.pipeline import PipelineRunner
from backend.core.context import PipelineContext
from backend.models.schemas import PipelineStepRequest, DownloadStepRequest, DownloadParams
from backend.core.steps.registry import StepRegistry

@pytest.mark.asyncio
async def test_pipeline_runner_success():
    # Setup
    runner = PipelineRunner()
    mock_step = AsyncMock()
    mock_step.execute = AsyncMock()
    mock_step.name = "download"
    
    # Mock Registry
    with patch.object(StepRegistry, 'get_step', return_value=mock_step) as mock_get_step:
        # Mock Task Manager
        with patch('src.core.pipeline.task_manager') as mock_tm:
            mock_tm.update_task = AsyncMock()
            mock_tm.is_cancelled.return_value = False

            # Use valid Pydantic model
            params = DownloadParams(url="https://example.com/video")
            step_req = DownloadStepRequest(step_name="download", params=params)
            steps = [step_req]
            
            # Execute
            result = await runner.run(steps, task_id="task-123")

            # Verify
            assert result["status"] == "completed"
            assert "download" in result["history"]
            mock_get_step.assert_called_with("download")
            mock_step.execute.assert_called_once()
            call_args = mock_step.execute.call_args
            # Check context and params passed correctly
            assert isinstance(call_args[0][0], PipelineContext)
            # Check if it was converted to dict
            assert call_args[0][1] == params.model_dump()
            assert call_args[0][2] == "task-123"

@pytest.mark.asyncio
async def test_pipeline_runner_cancellation():
    # Setup
    runner = PipelineRunner()
    
    # Mock Task Manager to simulate cancellation
    with patch('src.core.pipeline.task_manager') as mock_tm:
        mock_tm.update_task = AsyncMock()
        mock_tm.is_cancelled.return_value = True # Cancelled immediately

        params = DownloadParams(url="https://example.com/video")
        step_req = DownloadStepRequest(step_name="download", params=params)
        steps = [step_req]
        
        # Execute & Verify
        with pytest.raises(Exception, match="Pipeline cancelled"):
             await runner.run(steps, task_id="task-123")
        
        mock_tm.update_task.assert_called_with("task-123", status="cancelled", message="Pipeline cancelled by user")

@pytest.mark.asyncio
async def test_pipeline_runner_step_failure():
    # Setup
    runner = PipelineRunner()
    mock_step = AsyncMock()
    mock_step.execute.side_effect = Exception("Step Failed!")
    
    with patch.object(StepRegistry, 'get_step', return_value=mock_step):
        with patch('src.core.pipeline.task_manager') as mock_tm:
            mock_tm.update_task = AsyncMock()
            mock_tm.is_cancelled.return_value = False

            params = DownloadParams(url="https://example.com/video")
            step_req = DownloadStepRequest(step_name="download", params=params)
            steps = [step_req]
            
            # Execute & Verify
            with pytest.raises(Exception, match="Step Failed!"):
                await runner.run(steps, task_id="task-123")
            
            # Check if status updated to failed
            # The last call should be the failure update
            failure_call = mock_tm.update_task.call_args_list[-1]
            assert failure_call.kwargs["status"] == "failed"
            assert "Step Failed" in failure_call.kwargs["error"]
