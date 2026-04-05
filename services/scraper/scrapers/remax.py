"""
RE/MAX Portugal scraper.

RE/MAX Portugal exposes a GraphQL API used by their public website.
This module queries that API directly — all data is publicly visible
on remax.pt.

Endpoint: https://www.remax.pt/api/listings/search (GraphQL)
"""

import httpx
import logging
import re
from typing import List, Optional

from ..models.schemas import ScrapedProperty, PropertyType

logger = logging.getLogger(__name__)

REMAX_GRAPHQL_URL = "https://www.remax.pt/api/listings/search"
REMAX_BASE_URL = "https://www.remax.pt"

# RE/MAX property category IDs → PropertyType
CATEGORY_MAP: dict[int, PropertyType] = {
    1: PropertyType.APARTMENT,   # Apartamento
    2: PropertyType.HOUSE,       # Moradia
    3: PropertyType.VILLA,       # Vivenda
    4: PropertyType.COMMERCIAL,  # Comercial
    5: PropertyType.LAND,        # Terreno
    6: PropertyType.GARAGE,      # Garagem
    7: PropertyType.COMMERCIAL,  # Escritório
    8: PropertyType.COMMERCIAL,  # Loja
}

TYPOLOGY_STRING_MAP: dict[str, PropertyType] = {
    "Apartamento": PropertyType.APARTMENT,
    "Moradia": PropertyType.HOUSE,
    "Vivenda": PropertyType.VILLA,
    "Terreno": PropertyType.LAND,
    "Garagem": PropertyType.GARAGE,
    "Escritório": PropertyType.COMMERCIAL,
    "Loja": PropertyType.COMMERCIAL,
    "Armazém": PropertyType.COMMERCIAL,
}

CITY_SEARCH_TERMS: dict[str, str] = {
    "Lisboa": "Lisboa",
    "Porto": "Porto",
    "Cascais": "Cascais",
    "Algarve": "Faro",
    "Madeira": "Madeira",
    "Sintra": "Sintra",
    "Oeiras": "Oeiras",
}

# GraphQL query for property search
SEARCH_QUERY = """
query SearchListings($filters: ListingFiltersInput!, $page: Int, $pageSize: Int) {
  searchListings(filters: $filters, page: $page, pageSize: $pageSize) {
    total
    listings {
      id
      reference
      title
      description
      price
      area
      bedrooms
      bathrooms
      propertyType
      categoryId
      address {
        street
        parish
        municipality
        district
        latitude
        longitude
      }
      features
      photos {
        url
        main
      }
      url
      publishedAt
      agent {
        name
        license
      }
    }
  }
}
"""


def _parse_remax_listing(item: dict, city: str) -> Optional[ScrapedProperty]:
    """Convert a single RE/MAX GraphQL listing to ScrapedProperty."""
    try:
        price = float(item.get("price", 0) or 0)
        if price <= 0:
            return None

        # Property type resolution
        category_id = item.get("categoryId")
        type_string = item.get("propertyType", "")
        prop_type = (
            TYPOLOGY_STRING_MAP.get(type_string)
            or CATEGORY_MAP.get(category_id)
            or PropertyType.APARTMENT
        )

        area = item.get("area")
        area_m2 = float(area) if area else None
        price_m2 = round(price / area_m2, 0) if area_m2 and area_m2 > 0 else None

        address_obj = item.get("address") or {}
        street = address_obj.get("street", "")
        parish = address_obj.get("parish", "")
        municipality = address_obj.get("municipality", city)
        full_address = ", ".join(filter(None, [street, parish, municipality]))
        zone = parish or address_obj.get("district")

        # Images — prefer main photo first
        photos = sorted(
            item.get("photos") or [],
            key=lambda p: (0 if p.get("main") else 1),
        )
        images = [p["url"] for p in photos if p.get("url")][:10]

        features = item.get("features") or []
        if isinstance(features, str):
            features = [f.strip() for f in features.split(",") if f.strip()]

        listing_url = item.get("url", "")
        if listing_url and not listing_url.startswith("http"):
            listing_url = f"{REMAX_BASE_URL}{listing_url}"

        return ScrapedProperty(
            source="remax",
            source_ref=str(item.get("reference") or item.get("id", "")),
            source_url=listing_url,
            title=item.get("title") or f"{prop_type.value.title()} em {municipality}",
            description=(item.get("description") or "")[:1000],
            property_type=prop_type,
            price=price,
            area_m2=area_m2,
            price_m2=price_m2,
            bedrooms=item.get("bedrooms"),
            bathrooms=item.get("bathrooms"),
            address=full_address or None,
            zone=zone,
            city=municipality or city,
            country="PT",
            latitude=address_obj.get("latitude"),
            longitude=address_obj.get("longitude"),
            features=features,
            images=images,
            metadata={
                "agent_name": (item.get("agent") or {}).get("name"),
                "agent_license": (item.get("agent") or {}).get("license"),
                "published_at": item.get("publishedAt"),
                "remax_id": item.get("id"),
            },
        )
    except Exception as e:
        logger.warning("Failed to parse RE/MAX listing %s: %s", item.get("id"), e)
        return None


async def fetch_remax_properties(
    city: str = "Lisboa",
    max_items: int = 50,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_bedrooms: Optional[int] = None,
    property_type_id: Optional[int] = None,
) -> List[ScrapedProperty]:
    """
    Fetch property listings from RE/MAX Portugal.

    Args:
        city: Target city.
        max_items: Maximum listings to fetch.
        min_price: Minimum price filter.
        max_price: Maximum price filter.
        min_bedrooms: Minimum bedroom count.
        property_type_id: Optional category ID to filter by type.

    Returns:
        List of ScrapedProperty instances.
    """
    search_term = CITY_SEARCH_TERMS.get(city, city)
    properties: List[ScrapedProperty] = []

    filters: dict = {
        "location": search_term,
        "transactionType": "SALE",
        "country": "PT",
    }
    if min_price:
        filters["minPrice"] = int(min_price)
    if max_price:
        filters["maxPrice"] = int(max_price)
    if min_bedrooms:
        filters["minBedrooms"] = min_bedrooms
    if property_type_id:
        filters["categoryId"] = property_type_id

    page = 1
    page_size = min(max_items, 25)
    fetched = 0

    async with httpx.AsyncClient(
        timeout=30,
        follow_redirects=True,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; AgencyGroupBot/1.0)",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    ) as client:
        while fetched < max_items:
            try:
                resp = await client.post(
                    REMAX_GRAPHQL_URL,
                    json={
                        "query": SEARCH_QUERY,
                        "variables": {
                            "filters": filters,
                            "page": page,
                            "pageSize": page_size,
                        },
                    },
                )
                resp.raise_for_status()
                body = resp.json()

                if "errors" in body:
                    logger.error("RE/MAX GraphQL errors: %s", body["errors"])
                    break

                search_data = body.get("data", {}).get("searchListings", {})
                listings = search_data.get("listings") or []
                total = search_data.get("total", 0)

                if not listings:
                    logger.info("RE/MAX: no more results at page %d (total=%d)", page, total)
                    break

                for item in listings:
                    prop = _parse_remax_listing(item, city)
                    if prop:
                        properties.append(prop)
                        fetched += 1
                        if fetched >= max_items:
                            break

                logger.info(
                    "RE/MAX page %d: %d/%d listings parsed for %s",
                    page, len(listings), total, city,
                )

                if fetched >= total or fetched >= max_items:
                    break

                page += 1

            except httpx.HTTPStatusError as e:
                logger.error("RE/MAX HTTP error: %s — %s", e.response.status_code, e.response.text[:300])
                break
            except Exception as e:
                logger.error("RE/MAX fetch error page %d: %s", page, e, exc_info=True)
                break

    logger.info("RE/MAX fetch complete: %d properties for %s", len(properties), city)
    return properties
