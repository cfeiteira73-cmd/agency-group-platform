// =============================================================================
// Agency Group — Normalization Engine
// lib/ingestion/normalizationEngine.ts
//
// Normalizes raw property data from any source into a canonical shape.
// Routes to source-specific normalizers that map each provider's field
// schema to NormalizedProperty.
//
// TypeScript strict — 0 errors
// =============================================================================

// ─── Types ────────────────────────────────────────────────────────────────────

export type IngestionSource =
  | 'casafari'
  | 'idealista'
  | 'imovirtual'
  | 'era'
  | 'remax'
  | 'manual'
  | 'crm'

export interface RawPropertyData {
  source: IngestionSource
  source_id: string
  raw: Record<string, unknown>
}

export interface NormalizedProperty {
  source: IngestionSource
  source_id: string

  title: string
  description: string | null
  property_type: 'apartment' | 'house' | 'villa' | 'land' | 'commercial' | 'other'

  // Location
  address: string
  city: string
  zone: string | null
  country: string
  postal_code: string | null
  latitude: number | null
  longitude: number | null

  // Physical
  area_m2: number
  bedrooms: number | null
  bathrooms: number | null
  floor: number | null
  has_parking: boolean
  has_elevator: boolean
  energy_rating: string | null

  // Financial
  price_eur: number
  price_per_m2: number
  monthly_condo_eur: number | null

  // Dates
  listed_at: string
  last_updated_at: string

  // Media
  photo_urls: string[]
  virtual_tour_url: string | null

  // Raw reference
  source_url: string | null
}

// ─── Primitive helpers ────────────────────────────────────────────────────────

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : fallback
}

function num(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v))
  return isFinite(n) ? n : fallback
}

function optNum(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = parseFloat(String(v))
  return isFinite(n) ? n : null
}

function optStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

function bool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return v === 'true' || v === '1' || v === 'yes' || v === 'sim'
  if (typeof v === 'number') return v > 0
  return false
}

/**
 * Normalizes a raw property_type string into the canonical enum.
 * Handles Portuguese (T0–T5+, moradia, terreno), Spanish (piso, finca),
 * and English labels.
 */
function normalizePropertyType(raw: unknown): NormalizedProperty['property_type'] {
  const t = str(raw).toLowerCase()

  // Explicit canonical values pass through
  if (t === 'apartment') return 'apartment'
  if (t === 'house')     return 'house'
  if (t === 'villa')     return 'villa'
  if (t === 'land')      return 'land'
  if (t === 'commercial') return 'commercial'

  // Portuguese / Casafari typology codes
  if (/^t\d/.test(t) || t === 'apartamento' || t === 'flat' || t === 'penthouse') return 'apartment'
  if (t === 'moradia' || t === 'townhouse' || t === 'vivenda' || t === 'chalet' || t === 'detached') return 'house'
  if (t === 'terreno' || t === 'plot' || t === 'land' || t === 'lote') return 'land'
  if (t === 'loja' || t === 'office' || t === 'warehouse' || t === 'premises' || t === 'armazem') return 'commercial'
  if (t === 'piso' || t === 'dúplex' || t === 'duplex') return 'apartment'
  if (t === 'finca' || t === 'rural') return 'house'

  return 'other'
}

/**
 * Extracts photo URLs from a variety of shapes:
 * - string[]
 * - { url: string }[]
 * - { url: string; main: boolean }[]
 * - comma-separated string
 */
function extractPhotoUrls(raw: unknown): string[] {
  if (!raw) return []
  if (typeof raw === 'string') {
    return raw.split(',').map((s) => s.trim()).filter(Boolean)
  }
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'url' in item && typeof (item as Record<string, unknown>).url === 'string') {
          return (item as Record<string, unknown>).url as string
        }
        return null
      })
      .filter((url): url is string => typeof url === 'string' && url.startsWith('http'))
  }
  return []
}

function nowIso(): string {
  return new Date().toISOString()
}

// ─── Casafari normalizer ──────────────────────────────────────────────────────
// Casafari v3 field mapping:
//   id → source_id
//   typology → property_type (Portuguese codes T0–T5+, moradia, etc.)
//   gross_area / useful_area → area_m2
//   price → price_eur
//   latitude / longitude
//   parish → zone
//   municipality → city
//   district → country region
//   photos → photo_urls (array of { url, main })
//   energy_certificate → energy_rating
//   rooms → bedrooms
//   bathrooms
//   floor
//   url → source_url
//   published_at → listed_at
//   updated_at → last_updated_at

export function normalizeFromCasafari(raw: Record<string, unknown>): NormalizedProperty {
  const priceEur = num(raw.price ?? raw.price_eur, 0)
  const areaM2   = num(raw.gross_area ?? raw.useful_area ?? raw.area_m2 ?? raw.area, 0)
  const pricePerM2 = areaM2 > 0 ? Math.round((priceEur / areaM2) * 100) / 100 : 0

  const city    = str(raw.municipality ?? raw.city, '')
  const zone    = optStr(raw.parish ?? raw.zone ?? raw.neighborhood ?? raw.district)
  const country = str(raw.country, 'PT').toUpperCase()

  // Casafari stores photos as { url, main }[]
  const photoUrls = extractPhotoUrls(raw.photos)

  const features = Array.isArray(raw.features) ? (raw.features as string[]) : []
  const hasParking  = bool(raw.parking) || features.some((f) => /parking|garagem/i.test(f))
  const hasElevator = bool(raw.elevator) || features.some((f) => /elevator|lift|elevador/i.test(f))

  return {
    source:    'casafari',
    source_id: str(raw.id ?? raw.source_id, ''),

    title:         str(raw.title, `${str(raw.typology, 'Property')} em ${city}`),
    description:   optStr(raw.description),
    property_type: normalizePropertyType(raw.typology ?? raw.property_type),

    address:     str(raw.address ?? raw.street, city),
    city,
    zone,
    country,
    postal_code: optStr(raw.postal_code ?? raw.postcode),
    latitude:    optNum(raw.latitude),
    longitude:   optNum(raw.longitude),

    area_m2:    areaM2,
    bedrooms:   optNum(raw.rooms ?? raw.bedrooms ?? raw.bedroomCount),
    bathrooms:  optNum(raw.bathrooms ?? raw.bathroomCount),
    floor:      optNum(raw.floor),
    has_parking:  hasParking,
    has_elevator: hasElevator,
    energy_rating: optStr(raw.energy_certificate ?? raw.energy_rating),

    price_eur:        priceEur,
    price_per_m2:     pricePerM2,
    monthly_condo_eur: optNum(raw.monthly_condo ?? raw.condo_fee),

    listed_at:       str(raw.published_at ?? raw.listed_at, nowIso()),
    last_updated_at: str(raw.updated_at ?? raw.last_updated_at, nowIso()),

    photo_urls:       photoUrls,
    virtual_tour_url: optStr(raw.virtual_tour_url ?? raw.matterport_url ?? raw.tour_url),

    source_url: optStr(raw.url ?? raw.source_url),
  }
}

// ─── Idealista normalizer ─────────────────────────────────────────────────────
// Idealista v3.5 field mapping:
//   propertyCode → source_id
//   propertyType → property_type (flat, penthouse, villa, chalet, land, premises)
//   size → area_m2
//   price → price_eur
//   priceByArea → price_per_m2
//   address, municipality, province, country
//   latitude, longitude
//   photos → photo_urls ({ url: string }[])
//   rooms → bedrooms
//   bathrooms
//   floor (string — "1", "2", "bj" → 0 for ground floor)
//   url → source_url
//   modificationDate → last_updated_at (Unix timestamp)
//   publishDate → listed_at (Unix timestamp)
//   energy → energy_rating
//   exterior, hasLift, parkingSpace

export function normalizeFromIdealista(raw: Record<string, unknown>): NormalizedProperty {
  const priceEur    = num(raw.price ?? raw.priceInfo?.amount ?? 0, 0)
  const areaM2      = num(raw.size ?? raw.area_m2, 0)
  const pricePerM2  = optNum(raw.priceByArea) ?? (areaM2 > 0 ? Math.round((priceEur / areaM2) * 100) / 100 : 0)

  const city    = str(raw.municipality ?? raw.city, '')
  const country = str(raw.country, 'es').toUpperCase()

  // Idealista returns Unix timestamps for dates
  const listedAt: string = (() => {
    if (typeof raw.publishDate === 'number') return new Date(raw.publishDate * 1000).toISOString()
    return str(raw.listed_at ?? raw.publishDate, nowIso())
  })()
  const lastUpdatedAt: string = (() => {
    if (typeof raw.modificationDate === 'number') return new Date(raw.modificationDate * 1000).toISOString()
    return str(raw.updated_at ?? raw.last_updated_at, nowIso())
  })()

  // floor: Idealista returns string ("1", "2", "bj" = ground, "ss" = basement, "en" = mezzanine)
  const floorRaw = raw.floor
  let floor: number | null = null
  if (floorRaw != null) {
    const fStr = String(floorRaw).toLowerCase()
    if (/^[0-9]+$/.test(fStr)) floor = parseInt(fStr, 10)
    else if (fStr === 'bj' || fStr === 'ground' || fStr === 'rc') floor = 0
    else if (fStr === 'ss') floor = -1
    else floor = null
  }

  const photoUrls = extractPhotoUrls(raw.photos ?? (raw.thumbnail ? [{ url: raw.thumbnail }] : []))

  const parkingInfo = raw.parkingSpace as Record<string, unknown> | undefined
  const hasParking  = bool(raw.has_parking) || bool(parkingInfo?.hasParkingSpace) || bool(parkingInfo?.included)
  const hasElevator = bool(raw.hasLift ?? raw.has_elevator)

  // Energy from nested energy object
  const energyObj = raw.energy as Record<string, unknown> | undefined
  const energyRating = optStr(
    raw.energy_rating ??
    energyObj?.energyConsumption?.rating ??
    energyObj?.greenhouseEmissions?.rating,
  )

  // Title: use suggestedTexts or construct
  const suggestedTexts = raw.suggestedTexts as Record<string, unknown> | undefined
  const title = str(suggestedTexts?.title ?? raw.title, `${str(raw.propertyType, 'Property')} em ${city}`)

  return {
    source:    'idealista',
    source_id: str(raw.propertyCode ?? raw.source_id, ''),

    title,
    description:   optStr(raw.description),
    property_type: normalizePropertyType(raw.propertyType ?? raw.property_type),

    address:     str(raw.address, city),
    city,
    zone:        optStr(raw.district ?? raw.neighborhood ?? raw.zone),
    country,
    postal_code: optStr(raw.postal_code ?? raw.postalCode),
    latitude:    optNum(raw.latitude),
    longitude:   optNum(raw.longitude),

    area_m2:    areaM2,
    bedrooms:   optNum(raw.rooms ?? raw.bedrooms),
    bathrooms:  optNum(raw.bathrooms),
    floor,
    has_parking:  hasParking,
    has_elevator: hasElevator,
    energy_rating: energyRating,

    price_eur:        priceEur,
    price_per_m2:     pricePerM2,
    monthly_condo_eur: optNum(raw.monthly_condo ?? raw.condo_fee),

    listed_at:       listedAt,
    last_updated_at: lastUpdatedAt,

    photo_urls:       photoUrls,
    virtual_tour_url: optStr(raw.virtual_tour_url ?? (bool(raw.has3DTour) ? raw.url : null)),

    source_url: optStr(raw.url ?? raw.source_url),
  }
}

// ─── imovirtual normalizer ────────────────────────────────────────────────────
// imovirtual.com REST API field mapping (Portuguese portal):
//   id → source_id
//   category.label → property_type
//   params.m (area in m²) → area_m2
//   params.price → price_eur
//   location.city → city
//   location.suburb → zone
//   location.address → address
//   images → photo_urls ({ large: string }[])
//   characteristics (array of features)

export function normalizeFromImovirtual(raw: Record<string, unknown>): NormalizedProperty {
  // params is a key→value map in imovirtual
  const params  = (raw.params ?? {}) as Record<string, unknown>
  const location = (raw.location ?? {}) as Record<string, unknown>
  const category = (raw.category ?? {}) as Record<string, unknown>

  const priceEur   = num(params.price ?? params.Price ?? raw.price ?? raw.price_eur, 0)
  const areaM2     = num(params.m ?? params.area ?? raw.area_m2, 0)
  const pricePerM2 = areaM2 > 0 ? Math.round((priceEur / areaM2) * 100) / 100 : 0

  const city = str(location.city ?? location.municipality ?? raw.city, '')
  const zone = optStr(location.suburb ?? location.district ?? location.zone ?? raw.zone)

  // imovirtual images: { large, medium, small }[]
  const images = raw.images as Array<Record<string, unknown>> | undefined
  const photoUrls: string[] = images
    ? images.map((img) => str(img.large ?? img.medium ?? img.small ?? '')).filter(Boolean)
    : extractPhotoUrls(raw.photos ?? raw.photo_urls)

  const characteristics = Array.isArray(raw.characteristics)
    ? (raw.characteristics as string[])
    : []
  const hasParking  = bool(raw.has_parking)  || characteristics.some((c) => /parking|garagem/i.test(c))
  const hasElevator = bool(raw.has_elevator) || characteristics.some((c) => /elevator|elevador|lift/i.test(c))

  const title = str(raw.title ?? raw.name, `${str(category.label, 'Property')} em ${city}`)

  return {
    source:    'imovirtual',
    source_id: str(raw.id ?? raw.source_id, ''),

    title,
    description:   optStr(raw.description),
    property_type: normalizePropertyType(category.label ?? raw.property_type ?? raw.type),

    address:     str(location.address ?? location.street ?? raw.address, city),
    city,
    zone,
    country:     str(location.country ?? raw.country, 'PT').toUpperCase(),
    postal_code: optStr(location.postal_code ?? location.zipCode ?? raw.postal_code),
    latitude:    optNum(location.lat ?? location.latitude ?? raw.latitude),
    longitude:   optNum(location.lng ?? location.longitude ?? raw.longitude),

    area_m2:    areaM2,
    bedrooms:   optNum(params.rooms_num ?? params.bedrooms ?? raw.bedrooms),
    bathrooms:  optNum(params.bathrooms_num ?? params.bathrooms ?? raw.bathrooms),
    floor:      optNum(params.floor ?? raw.floor),
    has_parking:  hasParking,
    has_elevator: hasElevator,
    energy_rating: optStr(params.energy_certificate ?? raw.energy_rating),

    price_eur:        priceEur,
    price_per_m2:     pricePerM2,
    monthly_condo_eur: optNum(params.condo_fee ?? raw.monthly_condo_eur),

    listed_at:       str(raw.date_created ?? raw.listed_at ?? raw.published_at, nowIso()),
    last_updated_at: str(raw.date_modified ?? raw.updated_at ?? raw.last_updated_at, nowIso()),

    photo_urls:       photoUrls,
    virtual_tour_url: optStr(raw.virtual_tour_url ?? raw.tour_url),

    source_url: optStr(raw.url ?? raw.source_url),
  }
}

// ─── Manual normalizer ────────────────────────────────────────────────────────
// Passthrough with validation and defaults.
// Accepts any field from NormalizedProperty directly or common aliases.

export function normalizeFromManual(raw: Record<string, unknown>): NormalizedProperty {
  const source = (raw.source as IngestionSource | undefined) ?? 'manual'
  const priceEur   = num(raw.price_eur ?? raw.price ?? raw.valor, 0)
  const areaM2     = num(raw.area_m2 ?? raw.area, 0)
  const pricePerM2 = optNum(raw.price_per_m2) ?? (areaM2 > 0 ? Math.round((priceEur / areaM2) * 100) / 100 : 0)

  return {
    source: (['casafari','idealista','imovirtual','era','remax','manual','crm'] as IngestionSource[])
      .includes(source) ? source : 'manual',
    source_id: str(raw.source_id ?? raw.id, crypto.randomUUID()),

    title:         str(raw.title ?? raw.titulo ?? raw.name, 'Untitled Property'),
    description:   optStr(raw.description ?? raw.descricao),
    property_type: normalizePropertyType(raw.property_type ?? raw.type ?? raw.tipo),

    address:     str(raw.address ?? raw.morada ?? raw.direccion, ''),
    city:        str(raw.city ?? raw.cidade ?? raw.ciudad, ''),
    zone:        optStr(raw.zone ?? raw.zona ?? raw.neighborhood),
    country:     str(raw.country ?? raw.pais, 'PT').toUpperCase(),
    postal_code: optStr(raw.postal_code ?? raw.postcode ?? raw.cp),
    latitude:    optNum(raw.latitude ?? raw.lat),
    longitude:   optNum(raw.longitude ?? raw.lng ?? raw.lon),

    area_m2:    areaM2,
    bedrooms:   optNum(raw.bedrooms ?? raw.quartos ?? raw.habitaciones),
    bathrooms:  optNum(raw.bathrooms ?? raw.wc ?? raw.banos),
    floor:      optNum(raw.floor ?? raw.andar ?? raw.planta),
    has_parking:  bool(raw.has_parking ?? raw.parking),
    has_elevator: bool(raw.has_elevator ?? raw.elevator ?? raw.elevador),
    energy_rating: optStr(raw.energy_rating ?? raw.energy_certificate ?? raw.certificado_energetico),

    price_eur:        priceEur,
    price_per_m2:     pricePerM2,
    monthly_condo_eur: optNum(raw.monthly_condo_eur ?? raw.condo_fee ?? raw.condominio),

    listed_at:       str(raw.listed_at ?? raw.published_at ?? raw.created_at, nowIso()),
    last_updated_at: str(raw.last_updated_at ?? raw.updated_at, nowIso()),

    photo_urls:       extractPhotoUrls(raw.photo_urls ?? raw.photos),
    virtual_tour_url: optStr(raw.virtual_tour_url ?? raw.tour_url),

    source_url: optStr(raw.source_url ?? raw.url),
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

/**
 * Routes incoming RawPropertyData to the correct source-specific normalizer.
 */
export function normalize(data: RawPropertyData): NormalizedProperty {
  switch (data.source) {
    case 'casafari':
      return normalizeFromCasafari({ ...data.raw, id: data.raw.id ?? data.source_id })

    case 'idealista':
      return normalizeFromIdealista({
        ...data.raw,
        propertyCode: data.raw.propertyCode ?? data.source_id,
      })

    case 'imovirtual':
      return normalizeFromImovirtual({ ...data.raw, id: data.raw.id ?? data.source_id })

    case 'era':
    case 'remax':
    case 'crm':
    case 'manual':
      return normalizeFromManual({
        ...data.raw,
        source_id: data.raw.source_id ?? data.source_id,
        source:    data.source,
      })

    default: {
      // Exhaustive check
      const _exhaustive: never = data.source
      void _exhaustive
      return normalizeFromManual({
        ...data.raw,
        source_id: data.source_id,
        source:    data.source,
      })
    }
  }
}
