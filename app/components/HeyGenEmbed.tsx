'use client'

import { useEffect, useRef, useState } from 'react'

interface HeyGenEmbedProps {
  videoUrl: string
  title?: string
  posterUrl?: string
  className?: string
}

/**
 * Lazy-loaded HeyGen video embed for property detail pages.
 * Uses IntersectionObserver — only renders the iframe when the user scrolls near it.
 * Falls back to a native <video> element if the URL is a direct .mp4 link.
 */
export default function HeyGenEmbed({ videoUrl, title = 'Apresentação do Imóvel', posterUrl, className }: HeyGenEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const isDirectVideo = videoUrl.endsWith('.mp4') || videoUrl.endsWith('.webm') || videoUrl.endsWith('.mov')
  const isHeyGen = videoUrl.includes('heygen') || videoUrl.includes('heygenapp')

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16/9',
        background: '#0c1f15',
        overflow: 'hidden',
      }}
    >
      {!visible && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          cursor: 'pointer',
          background: posterUrl ? `url(${posterUrl}) center/cover` : '#0c1f15',
        }}
          onClick={() => setVisible(true)}
          role="button"
          tabIndex={0}
          aria-label={`Reproduzir: ${title}`}
          onKeyDown={e => e.key === 'Enter' && setVisible(true)}
        >
          {!posterUrl && (
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(201,169,110,0.15)',
              border: '2px solid #c9a96e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#c9a96e">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
          <span style={{
            fontFamily: 'var(--font-dm-mono), monospace',
            fontSize: '0.5rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#c9a96e',
          }}>
            {title}
          </span>
        </div>
      )}

      {visible && isDirectVideo && (
        <video
          src={videoUrl}
          controls
          autoPlay
          playsInline
          poster={posterUrl}
          onLoadedData={() => setLoaded(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          aria-label={title}
        />
      )}

      {visible && !isDirectVideo && (
        <>
          {!loaded && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0c1f15',
            }}>
              <div style={{
                width: 32,
                height: 32,
                border: '2px solid rgba(201,169,110,0.3)',
                borderTopColor: '#c9a96e',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}
          <iframe
            src={isHeyGen ? videoUrl : `${videoUrl}${videoUrl.includes('?') ? '&' : '?'}autoplay=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            onLoad={() => setLoaded(true)}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
              opacity: loaded ? 1 : 0,
              transition: 'opacity 0.4s',
            }}
          />
        </>
      )}
    </div>
  )
}
