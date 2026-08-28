"""Small Ollama adapter for non-authorizing agent assistance."""

import json

import httpx

from ..config import get_settings


async def draft_purchase(request_text: str, catalog: list[dict]) -> dict:
    settings = get_settings()
    prompt = (
        "You are a shopping assistant for Accord. Select exactly one product from the catalog "
        "for the user's request. Return JSON only with keys sku, quantity, reason. Never invent a SKU. "
        "quantity must be a positive integer and cannot exceed stock.\n"
        f"Catalog: {json.dumps(catalog, ensure_ascii=False)}\n"
        f"User request: {request_text}"
    )
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                f"{settings.ollama_base_url.rstrip('/')}/api/generate",
                json={"model": settings.ollama_model, "prompt": prompt, "stream": False, "format": "json"},
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise RuntimeError("Ollama is unavailable. Start Ollama and verify the configured model.") from exc

    raw = response.json().get("response", "")
    try:
        result = json.loads(raw)
    except (TypeError, json.JSONDecodeError) as exc:
        raise RuntimeError("Ollama returned an invalid purchase draft.") from exc
    if not isinstance(result, dict):
        raise RuntimeError("Ollama returned an invalid purchase draft.")
    return result
