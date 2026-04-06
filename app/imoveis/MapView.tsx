'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Property, formatPriceFull } from './data'

interface MapViewProps {
  properties: Property[]
  onPropertyClick?: (id: string) => void
  onDrawFilter?: (ids: string[]) => void
}

// ─── Point-in-polygon (ray-casting) ───────────────────────────────────────────
function pointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

// ─── Haversine distance in km ──────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function MapView({ properties, onPropertyClick, onDrawFilter }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const drawLayerRef = useRef<unknown>(null)
  const [drawMode, setDrawMode] = useState<null | 'polygon' | 'circle'>(null)
  const [filteredCount, setFilteredCount] = useState<number | null>(null)
  const [drawHint, setDrawHint] = useState('')
  const drawModeRef = useRef<null | 'polygon' | 'circle'>(null)

  // Keep ref in sync with state
  useEffect(() => { drawModeRef.current = drawMode }, [drawMode])

  const clearDraw = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L
    if (!L || !drawLayerRef.current || !mapInstanceRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(drawLayerRef.current as any).clearLayers()
    setFilteredCount(null)
    setDrawMode(null)
    setDrawHint('')
    if (onDrawFilter) onDrawFilter(properties.map(p => p.id))
  }, [properties, onDrawFilter])

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return
    if (mapInstanceRef.current) return

    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // Load Leaflet.draw CSS
    if (!document.getElementById('leaflet-draw-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-draw-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css'
      document.head.appendChild(link)
    }

    const initMap = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = (window as any).L
      if (!L || !mapRef.current || mapInstanceRef.current) return

      const map = L.map(mapRef.current, {
        center: [39.4, -8.2],
        zoom: 7,
        zoomControl: true,
        attributionControl: false,
        drawControl: false,
      })

      mapInstanceRef.current = map

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map)

      // Draw layer
      const drawnItems = new L.FeatureGroup()
      map.addLayer(drawnItems)
      drawLayerRef.current = drawnItems

      // Handle draw:created
      map.on(L.Draw?.Event?.CREATED || 'draw:created', (e: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const event = e as any
        drawnItems.clearLayers()
        drawnItems.addLayer(event.layer)

        let matchedIds: string[] = []

        if (event.layerType === 'polygon' || event.layerType === 'rectangle') {
          const latlngs = event.layer.getLatLngs()[0]
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const polygon: [number, number][] = latlngs.map((ll: any) => [ll.lat, ll.lng])
          matchedIds = properties
            .filter(p => pointInPolygon(p.lat, p.lng, polygon))
            .map(p => p.id)
        } else if (event.layerType === 'circle') {
          const center = event.layer.getLatLng()
          const radiusKm = event.layer.getRadius() / 1000
          matchedIds = properties
            .filter(p => haversine(p.lat, p.lng, center.lat, center.lng) <= radiusKm)
            .map(p => p.id)
        }

        setFilteredCount(matchedIds.length)
        setDrawMode(null)
        if (onDrawFilter) onDrawFilter(matchedIds)

        // Show search button inside drawn area
        setDrawHint(`${matchedIds.length} imóvel${matchedIds.length !== 1 ? 'is' : ''} nesta área`)
      })

      // Custom marker icon
      const badgeColor = (badge: string | null) => {
        if (badge === 'Exclusivo' || badge === 'Off-Market') return '#c9a96e'
        if (badge === 'Destaque') return '#e8c97a'
        if (badge === 'Novo') return '#4caf88'
        return '#c9a96e'
      }

      // Add markers
      properties.forEach(p => {
        const color = badgeColor(p.badge)
        const icon = L.divIcon({
          className: '',
          html: `
            <div style="background:#0c1f15;border:2px solid ${color};color:${color};font-family:var(--font-dm-mono),monospace;font-size:10px;letter-spacing:.08em;padding:5px 10px;white-space:nowrap;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.6);position:relative;">
              ${p.preco >= 1000000 ? '€' + (p.preco / 1000000).toFixed(1).replace('.', ',') + 'M' : '€' + Math.round(p.preco / 1000) + 'K'}
              <div style="position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid ${color};"></div>
            </div>
          `,
          iconAnchor: [40, 32],
          popupAnchor: [0, -35],
        })

        const popupHtml = `
          <div style="background:#0e2318;color:#f4f0e6;font-family:var(--font-jost),sans-serif;border:1px solid rgba(201,169,110,.25);padding:16px;min-width:220px;max-width:260px;">
            <div style="font-family:var(--font-dm-mono),monospace;font-size:10px;letter-spacing:.14em;color:rgba(201,169,110,.7);margin-bottom:6px;text-transform:uppercase;">${p.zona} · ${p.bairro}</div>
            <div style="font-family:var(--font-cormorant),serif;font-size:1.1rem;font-weight:300;color:#f4f0e6;margin-bottom:8px;line-height:1.3;">${p.nome}</div>
            <div style="font-size:11px;color:rgba(244,240,230,.45);margin-bottom:10px;">${p.area}m² · T${p.quartos} · ${p.casasBanho} WC</div>
            <div style="font-family:var(--font-cormorant),serif;font-size:1.25rem;color:#c9a96e;margin-bottom:12px;">${formatPriceFull(p.preco)}</div>
            <a href="/imoveis/${p.id}" style="display:block;background:#c9a96e;color:#0c1f15;text-align:center;padding:8px;font-family:var(--font-jost),sans-serif;font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;text-decoration:none;">Ver Imóvel →</a>
          </div>
        `

        const marker = L.marker([p.lat, p.lng], { icon })
          .addTo(map)
          .bindPopup(popupHtml, { className: 'ag-popup', maxWidth: 280, closeButton: false })

        marker.on('click', () => {
          if (onPropertyClick) onPropertyClick(p.id)
        })
      })

      // Custom popup CSS
      const style = document.createElement('style')
      style.textContent = `
        .ag-popup .leaflet-popup-content-wrapper { background:transparent!important;border:none!important;border-radius:0!important;box-shadow:0 8px 40px rgba(0,0,0,.5)!important;padding:0!important; }
        .ag-popup .leaflet-popup-content { margin:0!important; }
        .ag-popup .leaflet-popup-tip-container { display:none!important; }
        .leaflet-control-zoom { border:1px solid rgba(201,169,110,.2)!important; }
        .leaflet-control-zoom a { background:#0c1f15!important;color:#c9a96e!important;border-color:rgba(201,169,110,.2)!important; }
        .leaflet-control-zoom a:hover { background:#1c4a35!important; }
        .leaflet-draw-toolbar a { background-color:#0c1f15!important;border-color:rgba(201,169,110,.3)!important; }
        .leaflet-draw-actions li a { background:#0c1f15!important;color:#c9a96e!important; }
        .leaflet-draw-guide-dash { background:#c9a96e!important; }
        .leaflet-interactive { stroke:#c9a96e!important;fill:rgba(201,169,110,.1)!important; }
      `
      document.head.appendChild(style)

      // Fade out loading overlay
      setTimeout(() => {
        const el = document.getElementById('map-loading')
        if (el) el.style.opacity = '0'
      }, 1800)
    }

    const loadLeafletDraw = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).L?.Draw) { initMap(); return }
      const drawScript = document.createElement('script')
      drawScript.id = 'leaflet-draw-js'
      drawScript.src = 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js'
      drawScript.onload = initMap
      document.head.appendChild(drawScript)
    }

    const existingLeaflet = document.getElementById('leaflet-js')
    if (existingLeaflet) {
      loadLeafletDraw()
    } else {
      const script = document.createElement('script')
      script.id = 'leaflet-js'
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = loadLeafletDraw
      document.head.appendChild(script)
    }

    return () => {
      if (mapInstanceRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(mapInstanceRef.current as any).remove()
        mapInstanceRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers when filtered properties change
  useEffect(() => {
    if (!mapInstanceRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L
    if (!L) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapInstanceRef.current as any
    map.eachLayer((layer: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const l = layer as any
      if (l instanceof L.Marker) map.removeLayer(l)
    })

    properties.forEach(p => {
      const color = '#c9a96e'
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#0c1f15;border:2px solid ${color};color:${color};font-family:var(--font-dm-mono),monospace;font-size:10px;letter-spacing:.08em;padding:5px 10px;white-space:nowrap;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.6);position:relative;">${p.preco >= 1000000 ? '€' + (p.preco / 1000000).toFixed(1).replace('.', ',') + 'M' : '€' + Math.round(p.preco / 1000) + 'K'}<div style="position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid ${color};"></div></div>`,
        iconAnchor: [40, 32], popupAnchor: [0, -35],
      })
      const popupHtml = `<div style="background:#0e2318;color:#f4f0e6;font-family:var(--font-jost),sans-serif;border:1px solid rgba(201,169,110,.25);padding:16px;min-width:220px;max-width:260px;"><div style="font-family:var(--font-dm-mono),monospace;font-size:10px;letter-spacing:.14em;color:rgba(201,169,110,.7);margin-bottom:6px;text-transform:uppercase;">${p.zona} · ${p.bairro}</div><div style="font-family:var(--font-cormorant),serif;font-size:1.1rem;font-weight:300;color:#f4f0e6;margin-bottom:8px;line-height:1.3;">${p.nome}</div><div style="font-size:11px;color:rgba(244,240,230,.45);margin-bottom:10px;">${p.area}m² · T${p.quartos}</div><div style="font-family:var(--font-cormorant),serif;font-size:1.25rem;color:#c9a96e;margin-bottom:12px;">${formatPriceFull(p.preco)}</div><a href="/imoveis/${p.id}" style="display:block;background:#c9a96e;color:#0c1f15;text-align:center;padding:8px;font-family:var(--font-jost),sans-serif;font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;text-decoration:none;">Ver Imóvel →</a></div>`

      L.marker([p.lat, p.lng], { icon })
        .addTo(map)
        .bindPopup(popupHtml, { className: 'ag-popup', maxWidth: 280, closeButton: false })
    })
  }, [properties])

  // Activate draw tool
  const activateDraw = useCallback((mode: 'polygon' | 'circle') => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L
    if (!L || !mapInstanceRef.current || !drawLayerRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = mapInstanceRef.current as any

    setDrawMode(mode)
    clearDraw()

    const options = mode === 'polygon'
      ? new L.Draw.Polygon(map, {
          shapeOptions: { color: '#c9a96e', fillColor: 'rgba(201,169,110,.15)', weight: 2 }
        })
      : new L.Draw.Circle(map, {
          shapeOptions: { color: '#c9a96e', fillColor: 'rgba(201,169,110,.1)', weight: 2 }
        })

    options.enable()
    setDrawHint(mode === 'polygon' ? 'Clique para desenhar polígono. Duplo clique para terminar.' : 'Clique e arraste para definir raio.')
  }, [clearDraw])

  return (
    <div style={{ position: 'relative', width: '100%', height: '600px' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* Draw-to-Search toolbar */}
      <div style={{
        position: 'absolute', top: '16px', right: '16px', zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: '6px',
      }}>
        <button
          onClick={() => activateDraw('polygon')}
          title="Desenhar zona de pesquisa"
          style={{
            background: drawMode === 'polygon' ? '#c9a96e' : 'rgba(12,31,21,.92)',
            border: `1px solid ${drawMode === 'polygon' ? '#c9a96e' : 'rgba(201,169,110,.35)'}`,
            color: drawMode === 'polygon' ? '#0c1f15' : '#c9a96e',
            padding: '8px 14px',
            fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
            letterSpacing: '.12em', textTransform: 'uppercase',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            backdropFilter: 'blur(12px)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
          </svg>
          Polígono
        </button>
        <button
          onClick={() => activateDraw('circle')}
          title="Pesquisar por raio"
          style={{
            background: drawMode === 'circle' ? '#c9a96e' : 'rgba(12,31,21,.92)',
            border: `1px solid ${drawMode === 'circle' ? '#c9a96e' : 'rgba(201,169,110,.35)'}`,
            color: drawMode === 'circle' ? '#0c1f15' : '#c9a96e',
            padding: '8px 14px',
            fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
            letterSpacing: '.12em', textTransform: 'uppercase',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            backdropFilter: 'blur(12px)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
          </svg>
          Raio
        </button>
        {(filteredCount !== null || drawMode) && (
          <button
            onClick={clearDraw}
            style={{
              background: 'rgba(12,31,21,.92)',
              border: '1px solid rgba(244,240,230,.15)',
              color: 'rgba(244,240,230,.5)',
              padding: '8px 14px',
              fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
              letterSpacing: '.12em', textTransform: 'uppercase',
              cursor: 'pointer', backdropFilter: 'blur(12px)',
            }}
          >
            ✕ Limpar
          </button>
        )}
      </div>

      {/* Draw hint */}
      {drawHint && (
        <div style={{
          position: 'absolute', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000,
          background: filteredCount !== null ? '#c9a96e' : 'rgba(12,31,21,.95)',
          border: `1px solid ${filteredCount !== null ? '#c9a96e' : 'rgba(201,169,110,.3)'}`,
          color: filteredCount !== null ? '#0c1f15' : '#f4f0e6',
          padding: '10px 20px',
          fontFamily: "'Jost', sans-serif", fontSize: '.68rem',
          letterSpacing: '.08em', whiteSpace: 'nowrap',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 24px rgba(0,0,0,.4)',
        }}>
          {drawHint}
          {filteredCount !== null && filteredCount > 0 && ' · Grelha atualizada'}
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: '20px', left: '20px', zIndex: 1000,
        background: 'rgba(12,31,21,.92)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(201,169,110,.2)',
        padding: '12px 16px',
        fontFamily: "'DM Mono', monospace",
        fontSize: '.52rem', letterSpacing: '.14em',
        color: 'rgba(244,240,230,.5)',
      }}>
        <div style={{ color: '#c9a96e', marginBottom: '4px' }}>AGENCY GROUP</div>
        <div>{properties.length} imóveis · Portugal 2026</div>
        {filteredCount !== null && (
          <div style={{ color: '#c9a96e', marginTop: '4px' }}>
            {filteredCount} na área selecionada
          </div>
        )}
      </div>

      {/* Loading overlay */}
      <div id="map-loading" style={{
        position: 'absolute', inset: 0, zIndex: 999,
        background: '#0c1f15',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Mono', monospace", fontSize: '.52rem',
        letterSpacing: '.2em', color: 'rgba(201,169,110,.6)',
        pointerEvents: 'none',
        transition: 'opacity 0.5s',
      }}>
        A carregar mapa...
      </div>

      <style>{`
        #map-loading { animation: fadeOut 0.5s 2.5s forwards; }
        @keyframes fadeOut { to { opacity: 0; pointer-events: none; } }
      `}</style>
    </div>
  )
}
