from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import contextlib

from src.config import settings
from src.api.v1 import ingest, transcribe, pipeline, analyze, ws, tasks, cookies, translate

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):



    # Startup logic
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    settings.init_dirs()
    
    # Initialize Core Services
    from src.services.browser_service import browser_service
    await browser_service.start()
    
    logger.info(f"Directories initialized at {settings.BASE_DIR}")
    yield
    # Shutdown logic
    logger.info("Shutting down...")
    await browser_service.stop()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.include_router(ingest.router, prefix="/api/v1")
app.include_router(transcribe.router, prefix="/api/v1")
app.include_router(translate.router, prefix="/api/v1")
app.include_router(pipeline.router, prefix="/api/v1")
app.include_router(analyze.router, prefix="/api/v1")
app.include_router(ws.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(cookies.router, prefix="/api/v1")

# CORS (Allow Electron to connect)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Heartbeat endpoint to check if core is running."""
    return {
        "status": "online",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app", 
        host=settings.HOST, 
        port=settings.PORT, 
        reload=settings.DEBUG
    )
