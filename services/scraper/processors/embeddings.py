"""
Embeddings processor.

Generates vector embeddings for property descriptions and off-market signals
to enable semantic search and investor-property matching.

Supported providers:
  - Voyage AI (voyage-large-2 — 1024-dim, best for real estate text)
  - OpenAI (text-embedding-3-small — 1536-dim, fallback)
  - Anthropic (via Claude API — for enriched property narratives)

Set VOYAGE_API_KEY or OPENAI_API_KEY in environment.
"""

import logging
import os
from typing import List, Optional

import httpx

from ..models.schemas import ScrapedProperty, OffMarketSignal

logger = logging.getLogger(__name__)

VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings"
OPENAI_API_URL = "https://api.openai.com/v1/embeddings"

VOYAGE_MODEL = "voyage-large-2"
OPENAI_MODEL = "text-embedding-3-small"

# Max characters to embed (models have token limits)
MAX_TEXT_LENGTH = 2000


def _build_property_text(prop: ScrapedProperty) -> str:
    """
    Build a rich text representation of a property for embedding.
    Combines title, description, location, and key attributes.
    """
    parts = [
        f"{prop.property_type.value.title()} em {prop.zone or prop.city}, Portugal",
        prop.title,
    ]

    if prop.description:
        parts.append(prop.description[:500])

    location_parts = [p for p in [prop.address, prop.zone, prop.city] if p]
    if location_parts:
        parts.append("Localização: " + ", ".join(location_parts))

    specs = []
    if prop.bedrooms:
        specs.append(f"T{prop.bedrooms}")
    if prop.area_m2:
        specs.append(f"{prop.area_m2:.0f}m²")
    if prop.price_m2:
        specs.append(f"€{prop.price_m2:.0f}/m²")
    if specs:
        parts.append("Características: " + " | ".join(specs))

    if prop.features:
        parts.append("Extras: " + ", ".join(prop.features[:8]))

    parts.append(f"Preço: €{prop.price:,.0f}")

    return " | ".join(parts)[:MAX_TEXT_LENGTH]


def _build_signal_text(signal: OffMarketSignal) -> str:
    """Build text representation of an off-market signal for embedding."""
    parts = [
        f"Sinal {signal.signal_type.value}: {signal.title}",
        signal.description[:400] if signal.description else "",
    ]
    if signal.zone:
        parts.append(f"Zona: {signal.zone}")
    if signal.estimated_value:
        parts.append(f"Valor estimado: €{signal.estimated_value:,.0f}")
    return " | ".join(filter(None, parts))[:MAX_TEXT_LENGTH]


async def embed_texts_voyage(texts: List[str]) -> Optional[List[List[float]]]:
    """
    Generate embeddings using Voyage AI.

    Args:
        texts: List of strings to embed.

    Returns:
        List of embedding vectors (1024-dim each), or None on failure.
    """
    api_key = os.getenv("VOYAGE_API_KEY")
    if not api_key:
        logger.warning("VOYAGE_API_KEY not set")
        return None

    async with httpx.AsyncClient(timeout=60) as client:
        try:
            resp = await client.post(
                VOYAGE_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": VOYAGE_MODEL,
                    "input": texts,
                    "input_type": "document",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            embeddings = [item["embedding"] for item in sorted(data["data"], key=lambda x: x["index"])]
            logger.debug("Voyage embeddings: %d vectors, dim=%d", len(embeddings), len(embeddings[0]))
            return embeddings
        except httpx.HTTPStatusError as e:
            logger.error("Voyage HTTP error: %s — %s", e.response.status_code, e.response.text[:200])
        except Exception as e:
            logger.error("Voyage embed error: %s", e)
    return None


async def embed_texts_openai(texts: List[str]) -> Optional[List[List[float]]]:
    """
    Generate embeddings using OpenAI.

    Args:
        texts: List of strings to embed.

    Returns:
        List of embedding vectors (1536-dim each), or None on failure.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.warning("OPENAI_API_KEY not set")
        return None

    async with httpx.AsyncClient(timeout=60) as client:
        try:
            resp = await client.post(
                OPENAI_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": OPENAI_MODEL,
                    "input": texts,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            embeddings = [item["embedding"] for item in sorted(data["data"], key=lambda x: x["index"])]
            logger.debug("OpenAI embeddings: %d vectors, dim=%d", len(embeddings), len(embeddings[0]))
            return embeddings
        except httpx.HTTPStatusError as e:
            logger.error("OpenAI HTTP error: %s — %s", e.response.status_code, e.response.text[:200])
        except Exception as e:
            logger.error("OpenAI embed error: %s", e)
    return None


async def embed_texts(texts: List[str]) -> Optional[List[List[float]]]:
    """
    Generate embeddings using the best available provider.
    Tries Voyage AI first, falls back to OpenAI.

    Args:
        texts: List of strings to embed (max 100 per call).

    Returns:
        List of embedding vectors, or None if all providers fail.
    """
    # Batch limit guard
    if len(texts) > 100:
        logger.warning("Embedding batch capped at 100 (got %d)", len(texts))
        texts = texts[:100]

    result = await embed_texts_voyage(texts)
    if result:
        return result

    logger.info("Voyage unavailable — falling back to OpenAI")
    return await embed_texts_openai(texts)


async def embed_properties(properties: List[ScrapedProperty]) -> List[Optional[List[float]]]:
    """
    Generate embeddings for a list of properties.

    Args:
        properties: List of ScrapedProperty instances.

    Returns:
        List of embedding vectors (same order as input), with None for failures.
    """
    if not properties:
        return []

    texts = [_build_property_text(p) for p in properties]
    embeddings = await embed_texts(texts)

    if not embeddings:
        return [None] * len(properties)

    return embeddings


async def embed_signals(signals: List[OffMarketSignal]) -> List[Optional[List[float]]]:
    """
    Generate embeddings for a list of off-market signals.

    Args:
        signals: List of OffMarketSignal instances.

    Returns:
        List of embedding vectors (same order as input), with None for failures.
    """
    if not signals:
        return []

    texts = [_build_signal_text(s) for s in signals]
    embeddings = await embed_texts(texts)

    if not embeddings:
        return [None] * len(signals)

    return embeddings
