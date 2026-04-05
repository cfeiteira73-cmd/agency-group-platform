"""
Off-market signal and property opportunity scoring.

Scoring model:
  - Off-market signals: weighted multi-factor score (0-100)
  - Properties: investment opportunity score based on price, yield, and market position

Factors for off-market signals:
  1. Signal type urgency (insolvency > inheritance > divorce > relocation)
  2. Zone attractiveness (Lisboa/Cascais premium)
  3. Estimated value alignment with Agency Group target segment
  4. Recency (fresher signals score higher)
  5. Real estate keyword presence
  6. Value size (larger deals prioritised)
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from ..models.schemas import OffMarketSignal, ScrapedProperty, SignalType

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Signal scoring weights
# ---------------------------------------------------------------------------

SIGNAL_TYPE_SCORES: dict[SignalType, int] = {
    SignalType.INSOLVENCY: 40,      # Forced sale — highest urgency
    SignalType.MULTI_PROPERTY: 38,  # Multiple assets — portfolio opportunity
    SignalType.INHERITANCE: 35,     # Heirs often motivated to liquidate
    SignalType.DIVORCE: 30,         # Motivated but timeline variable
    SignalType.RELOCATION: 25,      # Motivated but may delay
}

ZONE_SCORE_BONUS: dict[str, int] = {
    "Cascais": 18,
    "Lisboa": 15,
    "Loulé": 14,
    "Lagos": 13,
    "Albufeira": 12,
    "Porto": 10,
    "Madeira": 8,
    "Algarve": 8,
    "Funchal": 7,
    "Braga": 4,
    "Coimbra": 4,
}

# Agency Group sweet spot: €500K–€3M
VALUE_SCORE_TABLE: List[Tuple[float, float, int]] = [
    (500_000, 3_000_000, 15),    # Core segment — max bonus
    (3_000_000, 10_000_000, 10), # HNWI segment — still valuable
    (200_000, 500_000, 8),       # Entry segment
    (100_000, 200_000, 4),       # Low segment
]

# Real estate keywords that confirm property involvement
PROPERTY_KEYWORDS = [
    "imóvel", "imóveis", "prédio", "prédios", "apartamento", "moradia",
    "vivenda", "terreno", "lote", "fracção", "fração", "habitação",
    "armazém", "loja", "escritório", "garagem", "rústico",
]

# Urgency keywords that increase actionability
URGENCY_KEYWORDS = [
    "urgente", "imediato", "liquidação imediata", "venda forçada",
    "prazo", "leilão", "hasta pública", "execução hipotecária",
]


def _value_score(estimated_value: Optional[float]) -> int:
    """Score based on estimated value alignment with Agency Group target segment."""
    if not estimated_value or estimated_value <= 0:
        return 0
    for low, high, score in VALUE_SCORE_TABLE:
        if low <= estimated_value <= high:
            return score
    return 2  # Non-zero but outside main segments


def _recency_score(found_at: datetime, now: Optional[datetime] = None) -> int:
    """Score based on how recently the signal was found. Fresher = higher score."""
    if now is None:
        now = datetime.now(timezone.utc)

    # Ensure timezone-aware comparison
    if found_at.tzinfo is None:
        found_at = found_at.replace(tzinfo=timezone.utc)

    days_old = (now - found_at).days
    if days_old <= 1:
        return 10
    elif days_old <= 3:
        return 7
    elif days_old <= 7:
        return 5
    elif days_old <= 14:
        return 3
    elif days_old <= 30:
        return 1
    return 0


def _keyword_score(text: str) -> int:
    """Score based on presence of property and urgency keywords."""
    text_lower = text.lower()
    score = 0
    for kw in PROPERTY_KEYWORDS:
        if kw in text_lower:
            score += 3
            break  # One hit is enough
    for kw in URGENCY_KEYWORDS:
        if kw in text_lower:
            score += 5
            break
    return min(score, 8)  # Cap at 8


def score_off_market_signal(signal: OffMarketSignal) -> int:
    """
    Compute a composite priority score (0-100) for an off-market signal.

    Higher score = more likely to be a motivated seller in a valuable zone.

    Args:
        signal: An OffMarketSignal instance.

    Returns:
        Integer score 0-100.
    """
    score = SIGNAL_TYPE_SCORES.get(signal.signal_type, 20)
    score += ZONE_SCORE_BONUS.get(signal.zone or "", 0)
    score += _value_score(signal.estimated_value)
    score += _recency_score(signal.found_at)

    combined_text = f"{signal.title} {signal.description}"
    score += _keyword_score(combined_text)

    final = min(score, 95)  # Reserve 96-100 for manually verified leads
    logger.debug(
        "Signal score: type=%s zone=%s value=%s → %d",
        signal.signal_type, signal.zone, signal.estimated_value, final,
    )
    return final


def score_properties_batch(
    properties: List[ScrapedProperty],
    zone_avg_map: Optional[dict[str, float]] = None,
) -> List[dict]:
    """
    Score a batch of properties as investment opportunities.

    Args:
        properties: List of ScrapedProperty instances.
        zone_avg_map: Optional override for zone benchmark prices.

    Returns:
        List of dicts with property ref, opportunity_score, and deal_label.
    """
    from .enrichment import _get_zone_benchmark, _compute_deal_tier

    results = []
    for prop in properties:
        try:
            zone_avg = (zone_avg_map or {}).get(prop.zone or "", None) or _get_zone_benchmark(prop.zone, prop.city)

            if prop.price_m2:
                price_m2 = prop.price_m2
            elif prop.area_m2 and prop.area_m2 > 0:
                price_m2 = prop.price / prop.area_m2
            else:
                price_m2 = zone_avg

            price_vs_market = ((price_m2 - zone_avg) / zone_avg) * 100
            deal_tier = _compute_deal_tier(price_vs_market)

            # Opportunity score: higher when priced below market
            opp_score = max(0, min(100, int(50 - price_vs_market)))

            results.append({
                "source_ref": prop.source_ref,
                "source": prop.source,
                "opportunity_score": opp_score,
                "deal_tier": deal_tier,
                "price_vs_market_pct": round(price_vs_market, 1),
                "price_m2": round(price_m2, 0),
                "zone_avg_m2": zone_avg,
            })
        except Exception as e:
            logger.warning("Score failed for %s: %s", prop.source_ref, e)

    results.sort(key=lambda x: x["opportunity_score"], reverse=True)
    return results
