"""Accord FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.ap2_router import router as ap2_router
from .api.telemetry_router import router as telemetry_router
from .api.transact_router import router as transact_router
from .api.policy_router import router as policy_router
from .api.catalog_router import router as catalog_router
from .api.auth_router import router as auth_router
from .database import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Accord Protocol Engine",
    version="1.0.0",
    description="AP2 catalog and policy-gated agent commerce gateway.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(ap2_router)
app.include_router(transact_router)
app.include_router(policy_router)
app.include_router(catalog_router)
app.include_router(auth_router)
app.include_router(telemetry_router)


@app.get("/health", tags=["Health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
