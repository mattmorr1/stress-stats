from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.config import settings
from api.routers.analysis import router
from api.routers.auth import router as auth_router
from api.routers.insights import router as insights_router
from api.routers.garmin_app import router as garmin_app_router

app = FastAPI(
    title="Stress Sentinel API",
    description="Burnout detection from Whoop/Garmin biometric data",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(auth_router)
app.include_router(insights_router)
app.include_router(garmin_app_router)


@app.get("/health")
def health():
    return {"status": "ok"}
