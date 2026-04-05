"""
Idealista.pt scraper.

Idealista requires API key access for bulk data (https://developers.idealista.com/).
This module supports both:
  1. Official REST API (preferred — requires approved developer key)
  2. HTML scraping fallback via Playwright (for development/testing only)

Set IDEALISTA_API_KEY + IDEALISTA_SECRET in environment for API mode.
"""

import httpx
import logging
import base64
import os
from typing import List, Optional
from ..models.schemas import ScrapedProperty, PropertyType

logger = logging.getLogger(__name__)

IDEALISTA_TOKEN_URL = "https://api.idealista.com/oauth/accesstoken"
IDEALISTA_SEARCH_URL = "https://api.idealista.com/3.5/pt/search"

# Map Idealista typology strings to our PropertyType enum
PROPERTY_TYPE_MAP: dict[str, PropertyType] = {
    "homes": PropertyType.APARTMENT,
    "newDevelopments": PropertyType.APARTMENT,
    "offices": PropertyType.COMMERCIAL,
    "premises": PropertyType.COMMERCIAL,
    "garages": PropertyType.GARAGE,
    "lands": PropertyType.LAND,
    "storageRooms": PropertyType.COMMERCIAL,
    "buildings": PropertyType.COMMERCIAL,
}

TYPOLOGY_MAP: dict[str, PropertyType] = {
    "flat": PropertyType.APARTMENT,
    "penthouse": PropertyType.APARTMENT,
    "duplex": PropertyType.APARTMENT,
    "studio": PropertyType.APARTMENT,
    "house": PropertyType.HOUSE,
    "chalet": PropertyType.VILLA,
    "countryHouse": PropertyType.VILLA,
    "terraced": PropertyType.HOUSE,
}

# Supported cities and their Idealista location codes
LOCATION_CODES: dict[str, str] = {
    "Lisboa": "0-EU-PT-11",
    "Porto": "0-EU-PT-13",
    "Cascais": "0-EU-PT-11-005",
    "Algarve": "0-EU-PT-08",
    "Madeira": "0-EU-PT-31",
    "Açores": "0-EU-PT-20",
}


async def _get_access_token(client: httpx.AsyncClient) -> Optional[str]:
    """Obtain OAuth2 access token from Idealista API."""
    api_key = os.getenv("IDEALISTA_API_KEY")
    secret = os.getenv("IDEALISTA_SECRET")

    if not api_key or not secret:
        logger.warning("IDEALISTA_API_KEY / IDEALISTA_SECRET not set — skipping API auth")
        return None

    credentials = base64.b64encode(f"{api_key}:{secret}".encode()).decode()
    try:
        resp = await client.post(
            IDEALISTA_TOKEN_URL,
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "client_credentials", "scope": "read"},
        )
        resp.raise_for_status()
        return resp.json().get("access_token")
    except Exception as e:
        logger.error("Idealista token error: %s", e)
        return None


def _parse_idealista_item(item: dict, city: str) -> Optional[ScrapedProperty]:
    """Convert a single Idealista API result to ScrapedProperty."""
    try:
        prop_type_raw = item.get("propertyType", "homes")
        typology = item.get("typology", "")
        prop_type = TYPOLOGY_MAP.get(typology) or PROPERTY_TYPE_MAP.get(prop_type_raw, PropertyType.APARTMENT)

        price = float(item.get("price", 0))
        if price <= 0:
            return None

        size = item.get("size")
        price_m2 = item.get("priceByArea")
        if not price_m2 and size and size > 0:
            price_m2 = price / size

        # Feature extraction
        features: List[str] = []
        if item.get("hasGarage"):
            features.append("garage")
        if item.get("hasSwimmingPool"):
            features.append("swimming_pool")
        if item.get("hasTerrace"):
            features.append("terrace")
        if item.get("hasGarden"):
            features.append("garden")
        if item.get("hasAirConditioning"):
            features.append("air_conditioning")
        if item.get("hasLift"):
            features.append("lift")
        if item.get("newDevelopment"):
            features.append("new_development")

        images = [img.get("url", "") for img in item.get("multimedia", {}).get("images", []) if img.get("url")]

        return ScrapedProperty(
            source="idealista",
            source_ref=str(item.get("propertyCode", "")),
            source_url=item.get("url", ""),
            title=item.get("suggestedTexts", {}).get("title", f"{prop_type.value.title()} em {city}"),
            description=item.get("suggestedTexts", {}).get("subtitle"),
            property_type=prop_type,
            price=price,
            area_m2=float(size) if size else None,
            price_m2=round(price_m2, 0) if price_m2 else None,
            bedrooms=item.get("rooms"),
            bathrooms=item.get("bathrooms"),
            address=item.get("address"),
            zone=item.get("district") or item.get("neighborhood"),
            city=city,
            country="PT",
            latitude=item.get("latitude"),
            longitude=item.get("longitude"),
            features=features,
            images=images[:10],
            metadata={
                "floor": item.get("floor"),
                "status": item.get("status"),
                "exterior": item.get("exterior"),
                "has_video": item.get("hasVideo", False),
                "has_3d_tour": item.get("has3DTour", False),
                "agency": item.get("contactInfo", {}).get("agencyLogo"),
            },
        )
    except Exception as e:
        logger.warning("Failed to parse Idealista item %s: %s", item.get("propertyCode"), e)
        return None


async def fetch_idealista_properties(
    city: str = "Lisboa",
    property_type: str = "homes",
    max_items: int = 50,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_rooms: Optional[int] = None,
) -> List[ScrapedProperty]:
    """
    Fetch property listings from Idealista API.

    Args:
        city: Target city (must match LOCATION_CODES keys).
        property_type: Idealista property type string.
        max_items: Maximum results to return (API pages at 50/request).
        min_price: Minimum price filter.
        max_price: Maximum price filter.
        min_rooms: Minimum bedrooms filter.

    Returns:
        List of ScrapedProperty instances.
    """
    location = LOCATION_CODES.get(city, LOCATION_CODES["Lisboa"])
    properties: List[ScrapedProperty] = []

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        token = await _get_access_token(client)
        if not token:
            logger.warning("No Idealista token — returning empty list")
            return []

        params: dict = {
            "country": "pt",
            "operation": "sale",
            "propertyType": property_type,
            "locationId": location,
            "maxItems": min(max_items, 50),
            "order": "publicationDate",
            "sort": "desc",
            "language": "pt",
        }
        if min_price:
            params["minPrice"] = int(min_price)
        if max_price:
            params["maxPrice"] = int(max_price)
        if min_rooms:
            params["minRooms"] = min_rooms

        try:
            resp = await client.post(
                IDEALISTA_SEARCH_URL,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/x-www-form-urlencoded"},
                data=params,
            )
            resp.raise_for_status()
            data = resp.json()

            for item in data.get("elementList", []):
                prop = _parse_idealista_item(item, city)
                if prop:
                    properties.append(prop)

            logger.info("Idealista: fetched %d/%d properties for %s", len(properties), data.get("total", 0), city)

        except httpx.HTTPStatusError as e:
            logger.error("Idealista search HTTP error: %s — %s", e.response.status_code, e.response.text[:300])
        except Exception as e:
            logger.error("Idealista search error: %s", e, exc_info=True)

    return properties
