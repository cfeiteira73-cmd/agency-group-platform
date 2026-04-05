"""
Property enrichment processor.

Enriches scraped properties with:
- Price/m² calculation
- Market comparison (vs zone benchmark)
- Gross rental yield estimate
- Deal scoring (below/above market %)

Data source: INE / Agency Group Research 2026
"""

import logging
from typing import List, Optional
from ..models.schemas import ScrapedProperty, EnrichmentResult

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 2026 market benchmarks — Agency Group Research + INE data
# ---------------------------------------------------------------------------

# Zone median sale prices (€/m²)
ZONE_BENCHMARKS: dict[str, float] = {
    "Lisboa": 5000,
    "Cascais": 4713,
    "Sintra": 3200,
    "Oeiras": 4100,
    "Almada": 3100,
    "Setúbal": 2800,
    "Sesimbra": 3400,
    "Algarve": 3941,
    "Faro": 3200,
    "Loulé": 4500,
    "Lagos": 4800,
    "Albufeira": 4200,
    "Tavira": 3600,
    "Porto": 3643,
    "Gaia": 3100,
    "Matosinhos": 3400,
    "Braga": 2100,
    "Guimarães": 1900,
    "Coimbra": 2300,
    "Aveiro": 2500,
    "Leiria": 1800,
    "Évora": 1800,
    "Beja": 1200,
    "Faro": 3200,
    "Madeira": 3760,
    "Funchal": 4200,
    "Açores": 1952,
    "Ponta Delgada": 2100,
    # National fallback
    "_national": 3076,
}

# Average gross rental yields by zone (%) — 2026 estimates
YIELD_BENCHMARKS: dict[str, float] = {
    "Lisboa": 4.2,
    "Cascais": 3.8,
    "Sintra": 5.0,
    "Oeiras": 4.5,
    "Algarve": 6.5,
    "Loulé": 7.0,
    "Lagos": 7.5,
    "Albufeira": 8.0,
    "Porto": 5.1,
    "Gaia": 5.5,
    "Matosinhos": 5.2,
    "Braga": 5.8,
    "Coimbra": 5.5,
    "Madeira": 7.2,
    "Funchal": 7.8,
    "Açores": 6.0,
    "_national": 4.5,
}

# Luxury premium factor per zone — multiplied when price > 2x zone avg
LUXURY_PREMIUM_ZONES: set[str] = {"Lisboa", "Cascais", "Algarve", "Loulé", "Lagos", "Madeira"}


def _get_zone_benchmark(zone: Optional[str], city: Optional[str]) -> float:
    """Resolve the most specific benchmark available for a property's location."""
    for key in [zone, city]:
        if key and key in ZONE_BENCHMARKS:
            return ZONE_BENCHMARKS[key]
    return ZONE_BENCHMARKS["_national"]


def _get_yield_benchmark(zone: Optional[str], city: Optional[str]) -> float:
    """Resolve the most specific yield benchmark available."""
    for key in [zone, city]:
        if key and key in YIELD_BENCHMARKS:
            return YIELD_BENCHMARKS[key]
    return YIELD_BENCHMARKS["_national"]


def _compute_deal_tier(price_vs_market: float) -> str:
    """
    Classify the deal relative to market.

    Returns a human-readable tier label.
    """
    if price_vs_market <= -20:
        return "EXCELLENT"   # 20%+ below market
    elif price_vs_market <= -10:
        return "GOOD"        # 10-20% below market
    elif price_vs_market <= 5:
        return "FAIR"        # Within ±5% of market
    elif price_vs_market <= 15:
        return "PREMIUM"     # 5-15% above market
    else:
        return "OVERPRICED"  # 15%+ above market


def enrich_property(prop: ScrapedProperty) -> EnrichmentResult:
    """
    Enrich a single scraped property with market data and investment metrics.

    Args:
        prop: A ScrapedProperty instance.

    Returns:
        EnrichmentResult with pricing, yield, and deal tier data.
    """
    zone_avg = _get_zone_benchmark(prop.zone, prop.city)
    yield_rate = _get_yield_benchmark(prop.zone, prop.city)

    # Compute price/m²
    price_m2: float
    if prop.price_m2 and prop.price_m2 > 0:
        price_m2 = prop.price_m2
    elif prop.area_m2 and prop.area_m2 > 0:
        price_m2 = prop.price / prop.area_m2
    else:
        price_m2 = zone_avg  # Fallback — cannot calculate without area
        logger.debug("No area for property %s — using zone avg as price_m2", prop.source_ref)

    price_vs_market = ((price_m2 - zone_avg) / zone_avg) * 100

    result = EnrichmentResult(
        property_id=prop.source_ref,
        price_m2=round(price_m2, 0),
        zone_avg_price_m2=zone_avg,
        price_vs_market=round(price_vs_market, 1),
        estimated_yield=round(yield_rate, 2),
    )

    logger.debug(
        "Enriched %s [%s]: €%.0f/m² vs zone €%.0f/m² (%+.1f%%) — yield %.1f%%",
        prop.source_ref, prop.zone or prop.city,
        price_m2, zone_avg, price_vs_market, yield_rate,
    )
    return result


def enrich_properties_bulk(properties: List[ScrapedProperty]) -> List[dict]:
    """
    Enrich a list of properties and return combined property + enrichment dicts.

    Args:
        properties: List of ScrapedProperty instances.

    Returns:
        List of dicts merging property data with enrichment results.
    """
    results = []
    for prop in properties:
        try:
            enrichment = enrich_property(prop)
            merged = {
                **prop.model_dump(),
                "enrichment": enrichment.model_dump(),
                "deal_tier": _compute_deal_tier(enrichment.price_vs_market),
            }
            results.append(merged)
        except Exception as e:
            logger.error("Enrichment failed for %s: %s", prop.source_ref, e)
    return results


def get_zone_benchmarks() -> dict:
    """Return all zone benchmarks as a structured dict."""
    zones = []
    processed: set[str] = set()
    for zone, price in ZONE_BENCHMARKS.items():
        if zone.startswith("_"):
            continue
        if zone in processed:
            continue
        processed.add(zone)
        zones.append({
            "zone": zone,
            "price_m2": price,
            "yield": YIELD_BENCHMARKS.get(zone, YIELD_BENCHMARKS["_national"]),
            "updated": "2026-04",
            "is_luxury_market": zone in LUXURY_PREMIUM_ZONES,
        })
    return {
        "zones": sorted(zones, key=lambda z: z["price_m2"], reverse=True),
        "national_median": ZONE_BENCHMARKS["_national"],
        "yoy_change": 17.6,
        "total_transactions_2025": 169812,
        "avg_days_on_market": 210,
        "source": "INE / Agency Group Research 2026",
    }
