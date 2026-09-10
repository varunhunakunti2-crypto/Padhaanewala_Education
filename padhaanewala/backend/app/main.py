from fastapi import FastAPI

app = FastAPI(
    title="Padhaanewala API",
    version="0.1.0",
    description="Padhaanewala Education Technology Platform - Backend API",
)


@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}