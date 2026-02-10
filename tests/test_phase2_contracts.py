import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock, patch

# Adjust import path if needed
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.models.schemas import TaskResult, FileRef, PipelineStepRequest
from src.core.pipeline import PipelineRunner
from src.core.context import PipelineContext
from src.core.steps import StepRegistry
from src.core.container import container, Services

@pytest.mark.asyncio
async def test_pipeline_runner_result_structure():
    runner = PipelineRunner()
    
    # Mock TaskManager
    mock_tm = AsyncMock()
    mock_tm.update_task.return_value = None
    # is_cancelled is synchronous in real implementation
    mock_tm.is_cancelled = MagicMock(return_value=False)
    
    # We need to patch container.get
    with patch('src.core.pipeline._get_task_manager', return_value=mock_tm):
        
        # Mock a step that adds data to context
        class MockStep:
            async def execute(self, ctx, params, task_id):
                ctx.set("video_path", "/tmp/video.mp4")
                ctx.set("some_meta", "value")

        # Patch StepRegistry.get_step
        with patch('src.core.steps.StepRegistry.get_step', return_value=MockStep()):
            
            # Create a mock request object since PipelineStepRequest is a Union and cannot be instantiated
            from pydantic import BaseModel
            class MockParams(BaseModel):
                pass

            class MockStepRequest(BaseModel):
                step_name: str
                params: MockParams

            steps = [MockStepRequest(step_name="mock_step", params=MockParams())]
            
            await runner.run(steps, task_id="test_task")
            
            # Check what was passed to update_task
            # The last call to update_task should be status="completed"
            # We can inspect call_args_list or most recent call
            assert mock_tm.update_task.called
            
            # Find the call with status="completed"
            completed_call = None
            for call in mock_tm.update_task.call_args_list:
                _, kwargs = call
                if kwargs.get("status") == "completed":
                    completed_call = kwargs
                    break
            
            assert completed_call is not None
            result = completed_call["result"]
            
            # Verification: Result should be a Dict representing TaskResult
            print(f"Result: {result}")
            assert result["success"] is True
            assert "files" in result
            assert "meta" in result
            
            # Check file extraction logic
            files = result["files"]
            assert len(files) == 1
            # Check if it's a dict (serialized) or object
            # Pydantic .dict() makes it a dict
            f0 = files[0] # Should be dict
            assert f0["path"] == "/tmp/video.mp4" 
            assert f0["type"] == "video"
            
            # Check meta
            meta = result["meta"]
            assert meta["video_path"] == "/tmp/video.mp4"
            assert meta["some_meta"] == "value"
            assert "execution_trace" in meta
