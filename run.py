import sys
import asyncio
import uvicorn
from src.config import settings

def main():
    # Critical: Force ProactorEventLoop on Windows BEFORE uvicorn starts
    if sys.platform == "win32":
        print(" [System] Enforcing WindowsProactorEventLoopPolicy for Playwright compatibility...")
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    # Run Uvicorn via API, not CLI, to ensure our policy sticks
    uvicorn.run(
        "src.main:app", 
        host=settings.HOST, 
        port=8001, 
        reload=False # Disable reload to ensure Policy sticks in the main process
    )

if __name__ == "__main__":
    main()
