'use client'
import { useEffect, useRef, useState } from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
  threshold?: number
  rootMargin?: string
}

export function LazySection({
  children,
  fallback = <div className="h-96 animate-pulse bg-gray-50 rounded-2xl" />,
  threshold = 0.1,
  rootMargin = '200px',
}: Props) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold, rootMargin }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold, rootMargin])

  return <div ref={ref}>{visible ? children : fallback}</div>
}
