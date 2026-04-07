import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const title    = searchParams.get('title')    || 'Luxury Real Estate Portugal'
  const subtitle = searchParams.get('subtitle') || 'Lisboa · Cascais · Porto · Algarve · Madeira'
  const zone     = searchParams.get('zone')     || ''
  const price    = searchParams.get('price')    || ''
  // type param reserved for future variant rendering
  // const type  = searchParams.get('type')     || 'default'

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #1c4a35 0%, #0d2b20 50%, #1c4a35 100%)',
          fontFamily: 'Georgia, serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Radial gold glow overlays */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse at 80% 20%, rgba(201,169,110,0.15) 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(201,169,110,0.10) 0%, transparent 50%)',
          display: 'flex',
        }} />

        {/* Gold diagonal stripe — thick */}
        <div style={{
          position: 'absolute',
          top: '-50px', right: '80px',
          width: '3px',
          height: '800px',
          background: 'linear-gradient(180deg, transparent, rgba(201,169,110,0.6), transparent)',
          transform: 'rotate(-15deg)',
          display: 'flex',
        }} />
        {/* Gold diagonal stripe — thin */}
        <div style={{
          position: 'absolute',
          top: '-50px', right: '120px',
          width: '1px',
          height: '800px',
          background: 'linear-gradient(180deg, transparent, rgba(201,169,110,0.3), transparent)',
          transform: 'rotate(-15deg)',
          display: 'flex',
        }} />

        {/* Corner accent — bottom right */}
        <div style={{
          position: 'absolute',
          bottom: '0', right: '0',
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle at bottom right, rgba(201,169,110,0.12) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* ── Content ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '60px 70px',
          height: '100%',
          justifyContent: 'space-between',
          position: 'relative',
        }}>

          {/* Top: Logo area */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* AG monogram badge */}
            <div style={{
              width: '52px', height: '52px',
              background: 'linear-gradient(135deg, #c9a96e, #a8843a)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: '900',
              color: 'white',
              letterSpacing: '-1px',
            }}>AG</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{
                color: 'white',
                fontSize: '20px',
                fontWeight: '700',
                letterSpacing: '1px',
              }}>AGENCY GROUP</span>
              <span style={{
                color: '#c9a96e',
                fontSize: '12px',
                letterSpacing: '3px',
                textTransform: 'uppercase',
              }}>AMI 22506 · LUXURY REAL ESTATE</span>
            </div>
          </div>

          {/* Middle: Main content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '800px' }}>
            {/* Zone & price pills */}
            {(zone || price) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px',
              }}>
                {zone && (
                  <div style={{
                    background: 'rgba(201,169,110,0.2)',
                    border: '1px solid rgba(201,169,110,0.5)',
                    borderRadius: '20px',
                    padding: '4px 14px',
                    color: '#c9a96e',
                    fontSize: '14px',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    display: 'flex',
                  }}>{zone}</div>
                )}
                {price && (
                  <div style={{
                    background: '#c9a96e',
                    borderRadius: '20px',
                    padding: '4px 14px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '700',
                    display: 'flex',
                  }}>{price}</div>
                )}
              </div>
            )}

            {/* Title */}
            <h1 style={{
              color: 'white',
              fontSize: title.length > 40 ? '42px' : '52px',
              fontWeight: '800',
              lineHeight: '1.15',
              margin: '0',
              letterSpacing: '-0.5px',
            }}>{title}</h1>

            {/* Subtitle */}
            <p style={{
              color: 'rgba(244,240,230,0.75)',
              fontSize: '20px',
              margin: '0',
              fontStyle: 'italic',
              letterSpacing: '0.5px',
            }}>{subtitle}</p>
          </div>

          {/* Bottom: Market stats bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(201,169,110,0.3)',
            paddingTop: '20px',
          }}>
            <div style={{ display: 'flex', gap: '40px' }}>
              {[
                { v: '€5.000/m²', l: 'Lisboa'  },
                { v: '€4.713/m²', l: 'Cascais' },
                { v: '€3.941/m²', l: 'Algarve' },
                { v: '€3.760/m²', l: 'Madeira' },
              ].map(({ v, l }) => (
                <div key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ color: '#c9a96e', fontSize: '16px', fontWeight: '700' }}>{v}</span>
                  <span style={{ color: 'rgba(244,240,230,0.5)', fontSize: '11px', letterSpacing: '1px' }}>{l}</span>
                </div>
              ))}
            </div>
            <div style={{ color: 'rgba(244,240,230,0.4)', fontSize: '13px', letterSpacing: '1px' }}>
              www.agencygroup.pt
            </div>
          </div>

        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
