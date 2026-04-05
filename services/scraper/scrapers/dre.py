"""
Diário da República scraper for off-market signals.
API: https://dre.pt/dre/api/v2/

Fetches signals related to insolvencies, inheritances, divorces, and relocations
that may indicate motivated sellers or off-market opportunities.
"""

import httpx
import logging
from typing import List, Optional
from ..models.schemas import OffMarketSignal, SignalType
import re
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

DRE_BASE = "https://dre.pt/dre/api/v2"

# Keywords mapped to signal types — Portuguese legal terminology
SIGNAL_KEYWORDS: dict[SignalType, list[str]] = {
    SignalType.INSOLVENCY: [
        "insolvência",
        "insolvente",
        "liquidação",
        "falência",
        "recuperação de empresa",
    ],
    SignalType.INHERITANCE: [
        "habilitação de herdeiros",
        "herança",
        "sucessão",
        "inventário",
        "partilha",
    ],
    SignalType.DIVORCE: [
        "divórcio",
        "separação de pessoas e bens",
        "partilha de bens",
    ],
    SignalType.RELOCATION: [
        "cancelamento de residência",
        "transferência",
    ],
}

# Zone detection patterns — ordered by specificity
ZONE_PATTERNS: dict[str, list[str]] = {
    "Cascais": ["cascais", "estoril", "parede", "alcabideche"],
    "Lisboa": ["lisboa", "alfama", "chiado", "belém", "lumiar", "benfica", "sintra", "oeiras", "amadora", "loures"],
    "Porto": ["porto", "gaia", "matosinhos", "maia", "gondomar", "valongo", "trofa"],
    "Algarve": ["faro", "loulé", "tavira", "lagos", "portimão", "albufeira", "silves", "olhão", "vila real de santo antónio"],
    "Madeira": ["funchal", "madeira", "caniço", "santa cruz"],
    "Açores": ["ponta delgada", "açores", "angra do heroísmo"],
    "Braga": ["braga", "guimarães", "barcelos", "famalicão"],
    "Coimbra": ["coimbra", "figueira da foz", "cantanhede"],
    "Évora": ["évora", "estremoz", "elvas"],
}

# Base priority scores per signal type (higher = more actionable for real estate)
BASE_PRIORITY: dict[SignalType, int] = {
    SignalType.INSOLVENCY: 40,
    SignalType.INHERITANCE: 35,
    SignalType.DIVORCE: 30,
    SignalType.RELOCATION: 25,
    SignalType.MULTI_PROPERTY: 45,
}

# Zone priority bonuses
ZONE_PRIORITY_BONUS: dict[str, int] = {
    "Lisboa": 15,
    "Cascais": 15,
    "Porto": 10,
    "Algarve": 8,
    "Madeira": 6,
}


async def fetch_dre_signals(days_back: int = 7) -> List[OffMarketSignal]:
    """
    Fetch off-market signals from the Diário da República public API.

    Args:
        days_back: Number of days to look back (max 30).

    Returns:
        List of OffMarketSignal instances, sorted by priority descending.
    """
    signals: List[OffMarketSignal] = []
    date_from = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        for signal_type, keywords in SIGNAL_KEYWORDS.items():
            # Use top 2 keywords per type to stay within rate limits
            for keyword in keywords[:2]:
                try:
                    resp = await client.get(
                        f"{DRE_BASE}/",
                        params={
                            "q": keyword,
                            "after": date_from,
                            "rows": 20,
                            "format": "json",
                        },
                        headers={"Accept": "application/json"},
                    )
                    resp.raise_for_status()
                    data = resp.json()

                    for item in data.get("results", []):
                        signal = _parse_dre_item(item, signal_type)
                        if signal:
                            signals.append(signal)

                except httpx.HTTPStatusError as e:
                    logger.warning("DRE HTTP error for '%s': %s %s", keyword, e.response.status_code, e.response.text[:200])
                except httpx.RequestError as e:
                    logger.warning("DRE request error for '%s': %s", keyword, e)
                except Exception as e:
                    logger.error("Unexpected DRE error for '%s': %s", keyword, e, exc_info=True)

    # Deduplicate by source_ref
    seen: set[str] = set()
    unique: List[OffMarketSignal] = []
    for s in signals:
        key = s.source_ref or s.title[:50]
        if key not in seen:
            seen.add(key)
            unique.append(s)

    unique.sort(key=lambda x: x.priority, reverse=True)
    logger.info("DRE fetch complete: %d unique signals over %d days", len(unique), days_back)
    return unique


def _parse_dre_item(item: dict, signal_type: SignalType) -> Optional[OffMarketSignal]:
    """
    Parse a single DRE API result dict into an OffMarketSignal.

    Returns None if the item lacks sufficient data to be actionable.
    """
    sumario = item.get("sumario", "") or ""
    text_body = item.get("text", "") or ""
    combined_text = f"{sumario} {text_body}".lower()

    if not sumario.strip():
        return None

    # Zone detection
    zone = _detect_zone(combined_text)

    # Value extraction — handles "€ 250.000" and "250,000 €" patterns
    estimated_value = _extract_value(combined_text)

    # Owner name extraction — simple heuristic from sumário
    owner_name = _extract_owner_name(sumario)

    # Priority scoring
    priority = BASE_PRIORITY.get(signal_type, 20)
    priority += ZONE_PRIORITY_BONUS.get(zone or "", 0)
    if estimated_value and estimated_value > 500_000:
        priority += 10
    if estimated_value and estimated_value > 1_000_000:
        priority += 5
    # Real estate keywords boost
    if any(kw in combined_text for kw in ["imóvel", "prédio", "apartamento", "moradia", "terreno", "lote"]):
        priority += 8
    priority = min(priority, 95)

    dre_date = item.get("data") or item.get("date")

    return OffMarketSignal(
        signal_type=signal_type,
        priority=priority,
        title=sumario[:200],
        description=text_body[:600],
        zone=zone,
        estimated_value=estimated_value,
        owner_name=owner_name,
        source="dre",
        source_ref=str(item.get("id", "")),
        metadata={
            "dre_number": item.get("numero"),
            "dre_date": dre_date,
            "dre_url": item.get("url"),
            "series": item.get("serie"),
            "dr_type": item.get("tipo"),
        },
    )


def _detect_zone(text: str) -> Optional[str]:
    """Detect the most specific Portuguese zone mentioned in text."""
    for zone_name, patterns in ZONE_PATTERNS.items():
        if any(p in text for p in patterns):
            return zone_name
    return None


def _extract_value(text: str) -> Optional[float]:
    """Extract the largest monetary value from text."""
    # Patterns: €250.000 | € 250,000 | 250.000€ | EUR 250000
    patterns = [
        r"€\s*([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)",
        r"([\d]{1,3}(?:[.,]\d{3})+)\s*€",
        r"eur\s+([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)",
    ]
    values: List[float] = []
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            raw = match.group(1)
            try:
                # Normalise: if last separator is comma with <=2 digits after it → decimal
                raw_clean = raw.replace(".", "").replace(",", ".")
                val = float(raw_clean)
                if val > 10_000:  # Ignore small values — not property prices
                    values.append(val)
            except ValueError:
                continue
    return max(values) if values else None


def _extract_owner_name(sumario: str) -> Optional[str]:
    """
    Heuristically extract a person or company name from the sumário.
    DRE sumários often start with the entity name.
    e.g. "João Silva — Insolvência" or "Empresa Lda., insolvência"
    """
    separators = [" — ", " – ", ", ", ". "]
    for sep in separators:
        if sep in sumario:
            candidate = sumario.split(sep)[0].strip()
            # Reject if it's a legal type keyword rather than a name
            if len(candidate) > 3 and not candidate.lower().startswith(("processo", "anúncio", "aviso", "despacho")):
                return candidate[:100]
    return None
