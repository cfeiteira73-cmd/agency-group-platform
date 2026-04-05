from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class PropertyType(str, Enum):
    APARTMENT = "apartment"
    HOUSE = "house"
    VILLA = "villa"
    COMMERCIAL = "commercial"
    LAND = "land"
    GARAGE = "garage"


class PropertyStatus(str, Enum):
    ACTIVE = "active"
    SOLD = "sold"
    RESERVED = "reserved"


class ScrapedProperty(BaseModel):
    source: str  # "idealista" | "imovirtual" | "remax"
    source_ref: str  # external ID
    source_url: str
    title: str
    description: Optional[str] = None
    property_type: PropertyType
    price: float
    area_m2: Optional[float] = None
    price_m2: Optional[float] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    address: Optional[str] = None
    zone: Optional[str] = None
    city: str = "Lisboa"
    country: str = "PT"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    features: List[str] = []
    images: List[str] = []
    metadata: dict = {}
    scraped_at: datetime = Field(default_factory=datetime.utcnow)


class SignalType(str, Enum):
    INHERITANCE = "inheritance"
    INSOLVENCY = "insolvency"
    DIVORCE = "divorce"
    RELOCATION = "relocation"
    MULTI_PROPERTY = "multi_property"


class OffMarketSignal(BaseModel):
    signal_type: SignalType
    priority: int  # 1-100
    title: str
    description: str
    address: Optional[str] = None
    zone: Optional[str] = None
    estimated_value: Optional[float] = None
    source: str = "dre"
    source_ref: Optional[str] = None
    owner_name: Optional[str] = None
    metadata: dict = {}
    found_at: datetime = Field(default_factory=datetime.utcnow)


class EnrichmentResult(BaseModel):
    property_id: str
    price_m2: float
    zone_avg_price_m2: float
    price_vs_market: float  # % above/below market
    estimated_yield: Optional[float] = None
    walk_score: Optional[int] = None
    transport_score: Optional[int] = None
    school_score: Optional[int] = None
    embedding: Optional[List[float]] = None  # 1536-dim or 1024-dim


class ScrapeJobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ScrapeJob(BaseModel):
    job_id: str
    source: str
    status: ScrapeJobStatus = ScrapeJobStatus.PENDING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    properties_found: int = 0
    errors: List[str] = []
    metadata: dict = {}


class BulkEnrichRequest(BaseModel):
    properties: List[ScrapedProperty]
    include_embeddings: bool = False


class MarketZone(BaseModel):
    zone: str
    price_m2: float
    yield_pct: float
    updated: str


class MarketOverview(BaseModel):
    zones: List[MarketZone]
    national_median: float
    yoy_change: float
    source: str
