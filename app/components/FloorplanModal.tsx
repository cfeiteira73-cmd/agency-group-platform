'use client'

interface FloorplanModalProps {
  propertyName: string
  area: number
  quartos: number
  casasBanho: number
  tipo: string
  onClose: () => void
}

function generateFloorplanSVG(area: number, quartos: number, casasBanho: number, tipo: string): string {
  const isVilla = ['Moradia', 'Villa', 'Herdade', 'Quinta'].includes(tipo)

  if (isVilla) {
    // Villa layout
    return `
      <rect x="10" y="10" width="380" height="280" fill="none" stroke="#c9a96e" stroke-width="2.5"/>
      <!-- Sala -->
      <rect x="10" y="10" width="160" height="120" fill="rgba(201,169,110,.05)" stroke="#c9a96e" stroke-width="1"/>
      <text x="90" y="65" text-anchor="middle" fill="#c9a96e" font-size="10" font-family="monospace">SALA DE ESTAR</text>
      <text x="90" y="80" text-anchor="middle" fill="rgba(244,240,230,.3)" font-size="8" font-family="monospace">${Math.round(area*0.22)}m²</text>
      <!-- Sofá -->
      <rect x="25" y="95" width="60" height="25" rx="4" fill="rgba(201,169,110,.12)" stroke="rgba(201,169,110,.3)" stroke-width="1"/>
      <!-- Cozinha -->
      <rect x="170" y="10" width="110" height="80" fill="rgba(201,169,110,.04)" stroke="#c9a96e" stroke-width="1"/>
      <text x="225" y="45" text-anchor="middle" fill="#c9a96e" font-size="10" font-family="monospace">COZINHA</text>
      <text x="225" y="60" text-anchor="middle" fill="rgba(244,240,230,.3)" font-size="8" font-family="monospace">${Math.round(area*0.12)}m²</text>
      <!-- Balcão cozinha -->
      <rect x="175" y="15" width="100" height="18" fill="rgba(201,169,110,.15)" stroke="rgba(201,169,110,.25)" stroke-width="1"/>
      <!-- Jantar -->
      <rect x="170" y="90" width="110" height="40" fill="rgba(201,169,110,.03)" stroke="#c9a96e" stroke-width="1"/>
      <text x="225" y="115" text-anchor="middle" fill="#c9a96e" font-size="9" font-family="monospace">JANTAR</text>
      <!-- Suites -->
      ${Array.from({length: Math.min(quartos, 4)}, (_, i) => {
        const col = i % 2
        const row = Math.floor(i / 2)
        const x = 10 + col * 100
        const y = 150 + row * 70
        const sArea = i === 0 ? Math.round(area*0.14) : Math.round(area*0.1)
        return `
          <rect x="${x}" y="${y}" width="95" height="65" fill="rgba(201,169,110,.04)" stroke="#c9a96e" stroke-width="1"/>
          <text x="${x+47}" y="${y+30}" text-anchor="middle" fill="#c9a96e" font-size="9" font-family="monospace">${i===0?'SUITE PRINC.':'SUITE '+(i+1)}</text>
          <text x="${x+47}" y="${y+44}" text-anchor="middle" fill="rgba(244,240,230,.3)" font-size="7" font-family="monospace">${sArea}m²</text>
          <!-- Cama -->
          <rect x="${x+20}" y="${y+46}" width="55" height="${i===0?30:24}" rx="3" fill="rgba(201,169,110,.1)" stroke="rgba(201,169,110,.2)" stroke-width="1"/>
        `
      }).join('')}
      <!-- WC -->
      ${Array.from({length: Math.min(casasBanho, 2)}, (_, i) => `
        <rect x="${280 + i*60}" y="150" width="55" height="45" fill="rgba(201,169,110,.04)" stroke="#c9a96e" stroke-width="1"/>
        <text x="${307+i*60}" y="170" text-anchor="middle" fill="#c9a96e" font-size="8" font-family="monospace">WC ${i+1}</text>
        <ellipse cx="${307+i*60}" cy="${182}" rx="10" ry="7" fill="rgba(201,169,110,.1)" stroke="rgba(201,169,110,.25)" stroke-width="1"/>
      `).join('')}
      <!-- Garagem -->
      <rect x="280" y="210" width="110" height="80" fill="rgba(28,74,53,.2)" stroke="#1c4a35" stroke-width="1.5"/>
      <text x="335" y="255" text-anchor="middle" fill="#4a9c7a" font-size="10" font-family="monospace">GARAGEM</text>
      <!-- Piscina hint -->
      <rect x="10" y="295" width="120" height="40" fill="rgba(0,80,160,.1)" stroke="rgba(0,120,255,.3)" stroke-width="1.5" rx="4"/>
      <text x="70" y="320" text-anchor="middle" fill="rgba(0,150,255,.6)" font-size="9" font-family="monospace">PISCINA</text>
      <!-- Dimensions -->
      <line x1="10" y1="345" x2="390" y2="345" stroke="rgba(201,169,110,.2)" stroke-width="1"/>
      <text x="200" y="355" text-anchor="middle" fill="rgba(201,169,110,.5)" font-size="8" font-family="monospace">~20m</text>
      <line x1="400" y1="10" x2="400" y2="290" stroke="rgba(201,169,110,.2)" stroke-width="1"/>
      <text x="408" y="150" fill="rgba(201,169,110,.5)" font-size="8" font-family="monospace">~15m</text>
    `
  }

  // Apartment layout
  const hasTerraco = area > 100
  return `
    <rect x="10" y="10" width="${hasTerraco ? 320 : 280}" height="240" fill="none" stroke="#c9a96e" stroke-width="2.5"/>
    ${hasTerraco ? '<rect x="330" y="10" width="60" height="120" fill="rgba(201,169,110,.04)" stroke="#c9a96e" stroke-width="1" stroke-dasharray="4 3"/><text x="360" y="65" text-anchor="middle" fill="rgba(201,169,110,.5)" font-size="8" font-family="monospace">TERRAÇO</text><text x="360" y="78" text-anchor="middle" fill="rgba(244,240,230,.2)" font-size="7" font-family="monospace">${Math.round(area*0.12)}m²</text>' : ''}
    <!-- Hall -->
    <rect x="10" y="10" width="60" height="240" fill="rgba(201,169,110,.03)" stroke="#c9a96e" stroke-width="1"/>
    <text x="40" y="135" text-anchor="middle" fill="rgba(201,169,110,.4)" font-size="8" font-family="monospace" transform="rotate(-90,40,135)">HALL · CORREDOR</text>
    <!-- Sala -->
    <rect x="70" y="10" width="130" height="110" fill="rgba(201,169,110,.05)" stroke="#c9a96e" stroke-width="1"/>
    <text x="135" y="55" text-anchor="middle" fill="#c9a96e" font-size="10" font-family="monospace">SALA</text>
    <text x="135" y="70" text-anchor="middle" fill="rgba(244,240,230,.3)" font-size="8" font-family="monospace">${Math.round(area*0.20)}m²</text>
    <!-- Sofá -->
    <rect x="80" y="88" width="75" height="25" rx="3" fill="rgba(201,169,110,.1)" stroke="rgba(201,169,110,.2)" stroke-width="1"/>
    <!-- Cozinha -->
    <rect x="200" y="10" width="90" height="90" fill="rgba(201,169,110,.04)" stroke="#c9a96e" stroke-width="1"/>
    <text x="245" y="48" text-anchor="middle" fill="#c9a96e" font-size="9" font-family="monospace">COZINHA</text>
    <text x="245" y="62" text-anchor="middle" fill="rgba(244,240,230,.3)" font-size="7" font-family="monospace">${Math.round(area*0.11)}m²</text>
    <rect x="205" y="15" width="80" height="16" fill="rgba(201,169,110,.12)" stroke="rgba(201,169,110,.25)" stroke-width="1"/>
    <!-- Quartos -->
    ${Array.from({length: Math.min(quartos, 3)}, (_, i) => {
      const x = 70 + i * 80
      const y = 130
      const w = i === 0 ? 90 : 75
      const sArea = i === 0 ? Math.round(area*0.16) : Math.round(area*0.11)
      return `
        <rect x="${x}" y="${y}" width="${w}" height="80" fill="rgba(201,169,110,.04)" stroke="#c9a96e" stroke-width="1"/>
        <text x="${x+w/2}" y="${y+32}" text-anchor="middle" fill="#c9a96e" font-size="9" font-family="monospace">${i===0?'SUITE':'Q.'+(i+1)}</text>
        <text x="${x+w/2}" y="${y+46}" text-anchor="middle" fill="rgba(244,240,230,.3)" font-size="7" font-family="monospace">${sArea}m²</text>
        <rect x="${x+10}" y="${y+52}" width="${w-20}" height="22" rx="3" fill="rgba(201,169,110,.1)" stroke="rgba(201,169,110,.2)" stroke-width="1"/>
      `
    }).join('')}
    <!-- WC -->
    ${Array.from({length: Math.min(casasBanho, 2)}, (_, i) => `
      <rect x="${200+i*45}" y="110" width="40" height="40" fill="rgba(201,169,110,.04)" stroke="#c9a96e" stroke-width="1"/>
      <text x="${220+i*45}" y="128" text-anchor="middle" fill="#c9a96e" font-size="8" font-family="monospace">WC</text>
      <ellipse cx="${220+i*45}" cy="${140}" rx="9" ry="6" fill="rgba(201,169,110,.08)" stroke="rgba(201,169,110,.2)" stroke-width="1"/>
    `).join('')}
    <!-- Dimensions -->
    <line x1="10" y1="258" x2="${hasTerraco?390:290}" y2="258" stroke="rgba(201,169,110,.2)" stroke-width="1"/>
    <text x="${hasTerraco?200:150}" y="268" text-anchor="middle" fill="rgba(201,169,110,.5)" font-size="8" font-family="monospace">~${Math.round(Math.sqrt(area)*1.4)}m</text>
  `
}

export default function FloorplanModal({ propertyName, area, quartos, casasBanho, tipo, onClose }: FloorplanModalProps) {
  const svgContent = generateFloorplanSVG(area, quartos, casasBanho, tipo)
  const waMsg = `Olá, gostaria de receber a planta detalhada do imóvel "${propertyName}".`

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#060d08', border: '1px solid rgba(201,169,110,.25)', maxWidth: '700px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(201,169,110,.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.22em', color: 'rgba(201,169,110,.6)', textTransform: 'uppercase', marginBottom: '4px' }}>Planta Baixa · Esquemática</div>
            <h2 style={{ fontFamily: "'Cormorant', serif", fontWeight: 300, fontSize: '1.4rem', color: '#f4f0e6', margin: 0 }}>{propertyName}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(244,240,230,.4)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(201,169,110,.08)', padding: '16px 32px' }}>
          {[
            ['Área Total', `${area} m²`],
            ['Quartos', `T${quartos}`],
            ['WC', String(casasBanho)],
            ['Tipologia', tipo],
          ].map(([label, val], i) => (
            <div key={label} style={{ paddingRight: '24px', marginRight: '24px', borderRight: i < 3 ? '1px solid rgba(201,169,110,.1)' : 'none' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '.52rem', letterSpacing: '.12em', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase', marginBottom: '3px' }}>{label}</div>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: '1.1rem', color: '#c9a96e', fontWeight: 300 }}>{val}</div>
            </div>
          ))}
        </div>

        {/* SVG Floorplan */}
        <div style={{ padding: '24px 32px', background: '#0a1a10' }}>
          <svg viewBox="0 0 420 370" style={{ width: '100%', height: 'auto', background: '#0a1a10' }}
            dangerouslySetInnerHTML={{ __html: svgContent }} />
        </div>

        {/* Disclaimer + CTA */}
        <div style={{ padding: '16px 32px 24px' }}>
          <p style={{ fontFamily: "'Jost', sans-serif", fontSize: '.72rem', color: 'rgba(244,240,230,.3)', margin: '0 0 16px', lineHeight: 1.5 }}>
            * Planta esquemática ilustrativa. As dimensões e disposição exactas podem variar. Solicite a planta oficial certificada.
          </p>
          <a href={`https://wa.me/351919948986?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-block', background: 'rgba(201,169,110,.1)', color: '#c9a96e', border: '1px solid rgba(201,169,110,.3)', padding: '10px 24px', fontFamily: "'Jost', sans-serif", fontSize: '.62rem', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Solicitar Planta Certificada →
          </a>
        </div>
      </div>
    </div>
  )
}
