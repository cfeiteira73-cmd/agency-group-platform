'use client'
import { useState, useRef, useEffect, useCallback, type ReactNode, type MouseEvent } from 'react'

interface TooltipProps {
  content: string
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  darkMode?: boolean
  shortcut?: string  // Optional keyboard shortcut shown alongside tooltip text
}

export default function Tooltip({
  content,
  children,
  position = 'top',
  delay = 500,
  darkMode,
  shortcut,
}: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = position === 'bottom' ? rect.bottom + 8 : rect.top - 8
      setCoords({ x, y })
      setVisible(true)
    }, delay)
  }, [delay, position])

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
  }, [])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const bg = darkMode ? 'rgba(6,14,9,.96)' : 'rgba(14,14,13,.92)'
  const border = darkMode ? 'rgba(201,169,110,.20)' : 'rgba(14,14,13,.15)'

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        style={{ display: 'contents' }}
      >
        {children}
      </div>
      {visible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{
            position: 'fixed',
            left: coords.x,
            top: position === 'bottom' ? coords.y : undefined,
            bottom: position === 'bottom' ? undefined : `calc(100vh - ${coords.y}px)`,
            transform: 'translateX(-50%)',
            zIndex: 9998,
            background: bg,
            border: `1px solid ${border}`,
            borderRadius: 6,
            padding: '5px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            pointerEvents: 'none',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 16px rgba(0,0,0,.20)',
            animation: 'fadeIn .15s ease both',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{
            fontFamily: 'var(--font-dm-mono), monospace',
            fontSize: '.58rem',
            letterSpacing: '.06em',
            color: '#f0ede4',
            fontWeight: 400,
          }}>
            {content}
          </span>
          {shortcut && (
            <kbd style={{
              fontFamily: 'var(--font-dm-mono), monospace',
              fontSize: '.52rem',
              letterSpacing: '.06em',
              color: 'rgba(201,169,110,.80)',
              background: 'rgba(201,169,110,.12)',
              border: '1px solid rgba(201,169,110,.25)',
              borderRadius: 3,
              padding: '1px 5px',
              marginLeft: 2,
            }}>
              {shortcut}
            </kbd>
          )}
        </div>
      )}
    </>
  )
}

// Hook version for more control
export function useTooltip() {
  const [tooltip, setTooltip] = useState<{
    content: string
    x: number
    y: number
    visible: boolean
    shortcut?: string
  }>({ content: '', x: 0, y: 0, visible: false })

  const show = useCallback((e: MouseEvent, content: string, shortcut?: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltip({
      content,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      visible: true,
      shortcut,
    })
  }, [])

  const hide = useCallback(() => {
    setTooltip(t => ({ ...t, visible: false }))
  }, [])

  return { tooltip, show, hide }
}
