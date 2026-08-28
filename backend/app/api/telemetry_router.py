import asyncio
import json

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from .telemetry import telemetry_hub

router = APIRouter(prefix="/api/v1/accord/telemetry", tags=["Telemetry"])


@router.get("/stream")
async def telemetry_stream(request: Request) -> StreamingResponse:
    async def events():
        async for queue in telemetry_hub.subscribe():
            while not await request.is_disconnected():
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"event: audit\ndata: {json.dumps(event, default=str)}\n\n"
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "Connection": "keep-alive"})
