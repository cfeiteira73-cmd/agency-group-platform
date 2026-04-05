"""
Agency Group Intelligence API — main FastAPI application.

Endpoints:
  GET  /health                  — liveness check
  GET  /signals/dre             — off-market signals from Diário da República
  POST /scrape/{source}         — trigger a scrape job (background)
  GET  /scrape/jobs/{job_id}    — check job status
  POST /enrich/property         — enrich a single property
  POST /enrich/bulk             — enrich multiple properties
  GET  /market/zones            — zone price benchmarks
  POST /score/signals           — re-score a batch of signals
  POST /score/properties        — score properties as investment opportunities
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .models.schemas import (
    BulkEnrichRequest,
    OffMarketSignal,
    ScrapedProperty,
    ScrapeJob,
    ScrapeJobStatus,
)
from .processors.enrichment import enrich_property, enrich_properties_bulk, get_zone_benchmarks
from .processors.scoring import score_off_market_signal, score_properties_batch
from .scrapers.dre import fetch_dre_signals
from .scrapers.idealista import fetch_idealista_properties
from .scrapers.imovirtual import fetch_imovirtual_properties
from .scrapers.remax import fetch_remax_properties

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Agency Group Intelligence API",
    description=(
        "Real estate data scraping, enrichment, and off-market signal detection service.\n\n"
        "Powers the Agency Group Deal Radar and Investor Intelligence dashboards."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory state (replace with Redis in production)
# ---------------------------------------------------------------------------
_cache: dict = {}
_CACHE_TTL_SECONDS = 21600  # 6 hours
_jobs: dict[str, ScrapeJob] = {}
_job_results: dict[str, List[ScrapedProperty]] = {}

SUPPORTED_SOURCES = {"idealista", "imovirtual", "remax", "dre"}


def _is_cache_fresh(key: str) -> bool:
    if key not in _cache:
        return False
    entry = _cache[key]
    age = (datetime.now(timezone.utc) - entry["at"]).total_seconds()
    return age < _CACHE_TTL_SECONDS


# ---------------------------------------------------------------------------
# Background scrape runner
# ---------------------------------------------------------------------------
async def _run_scrape_job(
    job_id: str,
    source: str,
    city: str,
    max_items: int,
    min_price: Optional[float],
    max_price: Optional[float],
) -> None:
    """Execute a scrape job and update its status."""
    job = _jobs[job_id]
    job.status = ScrapeJobStatus.RUNNING
    job.started_at = datetime.now(timezone.utc)

    try:
        properties: List[ScrapedProperty] = []

        if source == "idealista":
            properties = await fetch_idealista_properties(
                city=city, max_items=max_items,
                min_price=min_price, max_price=max_price,
            )
        elif source == "imovirtual":
            properties = await fetch_imovirtual_properties(
                city=city, max_pages=max(1, max_items // 25),
                min_price=min_price, max_price=max_price,
            )
        elif source == "remax":
            properties = await fetch_remax_properties(
                city=city, max_items=max_items,
                min_price=min_price, max_price=max_price,
            )

        _job_results[job_id] = properties
        job.properties_found = len(properties)
        job.status = ScrapeJobStatus.COMPLETED
        job.completed_at = datetime.now(timezone.utc)

        logger.info("Job %s [%s/%s] completed: %d properties", job_id, source, city, len(properties))

    except Exception as e:
        job.status = ScrapeJobStatus.FAILED
        job.errors.append(str(e))
        job.completed_at = datetime.now(timezone.utc)
        logger.error("Job %s failed: %s", job_id, e, exc_info=True)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health", tags=["System"])
async def health() -> dict:
    """Liveness / readiness check."""
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
        "active_jobs": sum(1 for j in _jobs.values() if j.status == ScrapeJobStatus.RUNNING),
        "cached_keys": len(_cache),
    }


@app.get("/signals/dre", response_model=List[OffMarketSignal], tags=["Signals"])
async def get_dre_signals(
    days_back: int = Query(default=7, ge=1, le=30, description="Days of DRE history to scan"),
    min_priority: int = Query(default=0, ge=0, le=100, description="Minimum priority score filter"),
    zone: Optional[str] = Query(default=None, description="Filter by zone (e.g. Lisboa, Porto)"),
    refresh: bool = Query(default=False, description="Bypass cache and force fresh fetch"),
) -> List[OffMarketSignal]:
    """
    Fetch off-market signals from Diário da República.

    Returns signals sorted by priority score descending.
    Results are cached for 6 hours unless `refresh=true`.
    """
    cache_key = f"dre_{days_back}_{min_priority}_{zone}"

    if not refresh and _is_cache_fresh(cache_key):
        logger.info("Returning cached DRE signals for key: %s", cache_key)
        return _cache[cache_key]["data"]

    signals = await fetch_dre_signals(days_back)

    # Re-score with our scoring engine
    for signal in signals:
        signal.priority = score_off_market_signal(signal)

    if min_priority > 0:
        signals = [s for s in signals if s.priority >= min_priority]
    if zone:
        signals = [s for s in signals if s.zone and s.zone.lower() == zone.lower()]

    signals.sort(key=lambda x: x.priority, reverse=True)

    _cache[cache_key] = {"data": signals, "at": datetime.now(timezone.utc)}
    return signals


@app.post("/scrape/{source}", response_model=ScrapeJob, status_code=202, tags=["Scraping"])
async def trigger_scrape(
    source: str,
    background_tasks: BackgroundTasks,
    city: str = Query(default="Lisboa", description="Target city"),
    max_items: int = Query(default=50, ge=1, le=200),
    min_price: Optional[float] = Query(default=None, description="Minimum price (€)"),
    max_price: Optional[float] = Query(default=None, description="Maximum price (€)"),
) -> ScrapeJob:
    """
    Trigger an asynchronous scrape job for a given source.

    Returns a job object immediately. Poll `/scrape/jobs/{job_id}` for status.

    Supported sources: idealista, imovirtual, remax
    """
    if source not in SUPPORTED_SOURCES - {"dre"}:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid source '{source}'. Supported: {', '.join(SUPPORTED_SOURCES - {'dre'})}",
        )

    job_id = str(uuid.uuid4())
    job = ScrapeJob(
        job_id=job_id,
        source=source,
        status=ScrapeJobStatus.PENDING,
        metadata={"city": city, "max_items": max_items},
    )
    _jobs[job_id] = job

    background_tasks.add_task(
        _run_scrape_job,
        job_id=job_id,
        source=source,
        city=city,
        max_items=max_items,
        min_price=min_price,
        max_price=max_price,
    )

    logger.info("Queued scrape job %s [%s/%s, max=%d]", job_id, source, city, max_items)
    return job


@app.get("/scrape/jobs/{job_id}", response_model=ScrapeJob, tags=["Scraping"])
async def get_job_status(job_id: str) -> ScrapeJob:
    """Check the status of a scrape job."""
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    return _jobs[job_id]


@app.get("/scrape/jobs/{job_id}/results", response_model=List[ScrapedProperty], tags=["Scraping"])
async def get_job_results(
    job_id: str,
    enrich: bool = Query(default=False, description="Include enrichment data in response"),
) -> List[ScrapedProperty] | List[dict]:
    """
    Retrieve the results of a completed scrape job.

    Optionally enrich all results with market data by passing `enrich=true`.
    """
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")

    job = _jobs[job_id]
    if job.status != ScrapeJobStatus.COMPLETED:
        raise HTTPException(
            status_code=409,
            detail=f"Job is not completed yet (status: {job.status})",
        )

    results = _job_results.get(job_id, [])

    if enrich:
        return enrich_properties_bulk(results)

    return results


@app.post("/enrich/property", response_model=dict, tags=["Enrichment"])
async def enrich_single_property(prop: ScrapedProperty) -> dict:
    """
    Enrich a single property with market data.

    Returns price/m², zone benchmark, market position (%), yield estimate,
    and deal tier classification.
    """
    result = enrich_property(prop)
    from .processors.enrichment import _compute_deal_tier
    return {
        **result.model_dump(),
        "deal_tier": _compute_deal_tier(result.price_vs_market),
    }


@app.post("/enrich/bulk", response_model=List[dict], tags=["Enrichment"])
async def enrich_bulk(request: BulkEnrichRequest) -> List[dict]:
    """
    Enrich multiple properties in a single call.

    Optionally include vector embeddings (requires VOYAGE_API_KEY or OPENAI_API_KEY).
    Returns merged property + enrichment data for each property.
    """
    if len(request.properties) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 properties per bulk request")

    results = enrich_properties_bulk(request.properties)

    if request.include_embeddings:
        try:
            from .processors.embeddings import embed_properties
            embeddings = await embed_properties(request.properties)
            for i, result in enumerate(results):
                result["embedding"] = embeddings[i]
        except Exception as e:
            logger.warning("Embedding generation failed: %s — returning without embeddings", e)

    return results


@app.get("/market/zones", tags=["Market Data"])
async def get_market_zones() -> dict:
    """
    Get current market benchmarks by zone.

    Data source: INE / Agency Group Research 2026.
    Includes price/m², gross yield %, YoY change, and luxury zone flags.
    """
    return get_zone_benchmarks()


@app.post("/score/signals", response_model=List[dict], tags=["Scoring"])
async def score_signals_batch(signals: List[OffMarketSignal]) -> List[dict]:
    """
    Score a batch of off-market signals using the Agency Group scoring model.

    Returns signals with updated priority scores, sorted highest first.
    """
    if len(signals) > 200:
        raise HTTPException(status_code=400, detail="Maximum 200 signals per batch")

    scored = []
    for signal in signals:
        new_score = score_off_market_signal(signal)
        signal.priority = new_score
        scored.append(signal.model_dump())

    scored.sort(key=lambda x: x["priority"], reverse=True)
    return scored


@app.post("/score/properties", response_model=List[dict], tags=["Scoring"])
async def score_properties(properties: List[ScrapedProperty]) -> List[dict]:
    """
    Score a batch of properties as investment opportunities.

    Returns properties with opportunity_score (0-100), deal_tier,
    and price vs market %, sorted by opportunity score descending.
    """
    if len(properties) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 properties per request")

    return score_properties_batch(properties)


# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": type(exc).__name__},
    )
