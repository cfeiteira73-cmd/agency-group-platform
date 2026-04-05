"""
Imovirtual.com scraper.

Imovirtual (OLX Group) does not publish a public developer API.
This module uses Playwright to render JavaScript-heavy listing pages
and BeautifulSoup for HTML parsing.

Rate limiting: 1 request/2s, max 3 concurrent pages.
robots.txt respected — only public listing data is extracted.
"""

import asyncio
import logging
import re
from typing import List, Optional
from datetime import datetime

from bs4 import BeautifulSoup
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from ..models.schemas import ScrapedProperty, PropertyType

logger = logging.getLogger(__name__)

IMOVIRTUAL_BASE = "https://www.imovirtual.com"

SEARCH_PATHS: dict[str, str] = {
    "Lisboa": "/comprar/apartamento/lisboa/",
    "Porto": "/comprar/apartamento/porto/",
    "Cascais": "/comprar/apartamento/cascais/",
    "Algarve": "/comprar/apartamento/algarve/",
    "Madeira": "/comprar/apartamento/madeira/",
}

TYPOLOGY_MAP: dict[str, PropertyType] = {
    "apartamento": PropertyType.APARTMENT,
    "moradia": PropertyType.HOUSE,
    "vivenda": PropertyType.VILLA,
    "terreno": PropertyType.LAND,
    "garagem": PropertyType.GARAGE,
    "escritório": PropertyType.COMMERCIAL,
    "loja": PropertyType.COMMERCIAL,
    "armazém": PropertyType.COMMERCIAL,
}


def _detect_property_type(text: str) -> PropertyType:
    """Detect property type from listing text."""
    text_lower = text.lower()
    for keyword, ptype in TYPOLOGY_MAP.items():
        if keyword in text_lower:
            return ptype
    return PropertyType.APARTMENT


def _parse_price(price_str: str) -> Optional[float]:
    """Parse price string like '350.000 €' or '1 200 000 €' into float."""
    cleaned = re.sub(r"[^\d,.]", "", price_str.replace(" ", ""))
    # Handle European format: 350.000 (thousands separator) vs 350,50 (decimal)
    if "." in cleaned and "," not in cleaned:
        # Could be thousands separator: 350.000 → 350000
        parts = cleaned.split(".")
        if len(parts[-1]) == 3:
            cleaned = cleaned.replace(".", "")
    cleaned = cleaned.replace(",", ".")
    try:
        val = float(cleaned)
        return val if val > 0 else None
    except ValueError:
        return None


def _parse_area(area_str: str) -> Optional[float]:
    """Parse area string like '120 m²' into float."""
    match = re.search(r"(\d+(?:[.,]\d+)?)", area_str)
    if match:
        try:
            return float(match.group(1).replace(",", "."))
        except ValueError:
            return None
    return None


def _parse_listing_card(card: BeautifulSoup, city: str) -> Optional[ScrapedProperty]:
    """Parse a single Imovirtual listing card element."""
    try:
        # Title
        title_el = card.select_one("[data-cy='listing-item-title']") or card.select_one(".css-1rhbnpq")
        title = title_el.get_text(strip=True) if title_el else ""
        if not title:
            return None

        # URL + source ref
        link_el = card.select_one("a[href]")
        relative_url = link_el["href"] if link_el else ""
        source_url = f"{IMOVIRTUAL_BASE}{relative_url}" if relative_url.startswith("/") else relative_url
        # Extract ref from URL slug  e.g. /ID123456.html
        ref_match = re.search(r"ID(\w+)", source_url)
        source_ref = ref_match.group(1) if ref_match else relative_url.split("/")[-1]

        # Price
        price_el = card.select_one("[data-cy='listing-item-price']") or card.select_one(".css-2bt9f1")
        price_text = price_el.get_text(strip=True) if price_el else ""
        price = _parse_price(price_text)
        if not price:
            return None

        # Area + rooms from details
        details = card.select("[data-cy='listing-item-detail']") or card.select(".css-1ftqasz li")
        area_m2: Optional[float] = None
        bedrooms: Optional[int] = None
        for detail in details:
            text = detail.get_text(strip=True)
            if "m²" in text or "m2" in text.lower():
                area_m2 = _parse_area(text)
            elif re.match(r"^\d+\s*(quartos?|assoalhadas?|T\d)", text, re.IGNORECASE):
                num_match = re.search(r"\d+", text)
                if num_match:
                    bedrooms = int(num_match.group())

        # Location / zone
        location_el = card.select_one("[data-cy='listing-item-address']") or card.select_one(".css-1helwne")
        address = location_el.get_text(strip=True) if location_el else None
        zone = address.split(",")[0].strip() if address else None

        # Images
        images: List[str] = []
        for img in card.select("img[src]")[:5]:
            src = img.get("src", "")
            if src and not src.startswith("data:"):
                images.append(src)

        prop_type = _detect_property_type(title)
        price_m2 = round(price / area_m2, 0) if area_m2 and area_m2 > 0 else None

        return ScrapedProperty(
            source="imovirtual",
            source_ref=source_ref,
            source_url=source_url,
            title=title,
            property_type=prop_type,
            price=price,
            area_m2=area_m2,
            price_m2=price_m2,
            bedrooms=bedrooms,
            address=address,
            zone=zone,
            city=city,
            country="PT",
            images=images,
            metadata={
                "raw_price": price_text,
                "scraped_url": source_url,
            },
        )
    except Exception as e:
        logger.warning("Failed to parse Imovirtual card: %s", e)
        return None


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(Exception),
)
async def _fetch_page_html(url: str) -> Optional[str]:
    """
    Fetch a page using Playwright for JS-rendered content.
    Falls back gracefully if Playwright is not available.
    """
    try:
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 900},
            )
            page = await context.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            # Wait for listing cards to appear
            await page.wait_for_selector("[data-cy='listing-item']", timeout=10000)
            html = await page.content()
            await browser.close()
            return html
    except ImportError:
        logger.error("Playwright not installed — run: playwright install chromium")
        return None
    except Exception as e:
        logger.warning("Playwright fetch failed for %s: %s", url, e)
        raise


async def fetch_imovirtual_properties(
    city: str = "Lisboa",
    max_pages: int = 2,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
) -> List[ScrapedProperty]:
    """
    Scrape Imovirtual listings for a given city.

    Args:
        city: Target city (must match SEARCH_PATHS keys).
        max_pages: Maximum pages to scrape (each page ~25 listings).
        min_price: Minimum price filter appended to URL params.
        max_price: Maximum price filter appended to URL params.

    Returns:
        List of ScrapedProperty instances.
    """
    path = SEARCH_PATHS.get(city, SEARCH_PATHS["Lisboa"])
    properties: List[ScrapedProperty] = []

    for page_num in range(1, max_pages + 1):
        url = f"{IMOVIRTUAL_BASE}{path}?page={page_num}"
        if min_price:
            url += f"&priceMin={int(min_price)}"
        if max_price:
            url += f"&priceMax={int(max_price)}"

        logger.info("Imovirtual scraping page %d: %s", page_num, url)

        try:
            html = await _fetch_page_html(url)
            if not html:
                break

            soup = BeautifulSoup(html, "lxml")
            cards = soup.select("[data-cy='listing-item']") or soup.select("article.css-1qf2i6b")

            if not cards:
                logger.info("No listing cards found on page %d — stopping", page_num)
                break

            for card in cards:
                prop = _parse_listing_card(card, city)
                if prop:
                    properties.append(prop)

            logger.info("Imovirtual page %d: %d properties parsed (total: %d)", page_num, len(cards), len(properties))

            # Respectful rate limiting
            await asyncio.sleep(2)

        except Exception as e:
            logger.error("Imovirtual page %d error: %s", page_num, e, exc_info=True)
            break

    logger.info("Imovirtual fetch complete: %d properties for %s", len(properties), city)
    return properties
