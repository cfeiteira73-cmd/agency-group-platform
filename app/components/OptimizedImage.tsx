'use client'
import Image from 'next/image'
import { useState } from 'react'

interface Props {
  src: string
  alt: string
  width?: number
  height?: number
  fill?: boolean
  priority?: boolean
  className?: string
  sizes?: string
}

export function OptimizedImage({
  src,
  alt,
  fill,
  priority,
  className,
  sizes,
  width,
  height,
}: Props) {
  const [error, setError] = useState(false)

  // Fallback for broken images — luxury real estate placeholder
  const fallbackSrc =
    'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80'

  if (fill) {
    return (
      <Image
        src={error ? fallbackSrc : src}
        alt={alt}
        fill
        priority={priority}
        className={className}
        sizes={
          sizes ||
          '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
        }
        onError={() => setError(true)}
        style={{ objectFit: 'cover' }}
      />
    )
  }

  return (
    <Image
      src={error ? fallbackSrc : src}
      alt={alt}
      width={width || 800}
      height={height || 600}
      priority={priority}
      className={className}
      sizes={
        sizes ||
        '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
      }
      onError={() => setError(true)}
    />
  )
}
