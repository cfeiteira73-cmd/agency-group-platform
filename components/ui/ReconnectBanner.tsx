'use client'

import { useState, useEffect, useCallback, type JSX } from 'react'

interface ReconnectBannerProps {
  isConnected: boolean
  onReconnect?: () => void
  reconnectInterval?: number // ms, default 5000
}

export function ReconnectBanner({
  isConnected,
  onReconnect,
  reconnectInterval = 5000,
}: ReconnectBannerProps): JSX.Element | null {
  const [visible, setVisible] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [reconnecting, setReconnecting] = useState(false)

  useEffect(() => {
    if (!isConnected) {
      // Show after 1s of disconnection
      const timer = setTimeout(() => setVisible(true), 1000)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
      setReconnecting(false)
      setCountdown(0)
      return undefined
    }
  }, [isConnected])

  useEffect(() => {
    if (!visible || isConnected) return
    setCountdown(Math.floor(reconnectInterval / 1000))
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [visible, isConnected, reconnectInterval])

  const handleReconnect = useCallback(() => {
    setReconnecting(true)
    onReconnect?.()
    setTimeout(() => setReconnecting(false), 3000)
  }, [onReconnect])

  if (!visible) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 bg-amber-500 text-white text-sm font-medium shadow-md"
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-white animate-pulse" aria-hidden="true" />
        <span>
          Connection lost —{' '}
          {reconnecting ? 'Reconnecting...' : `Retrying in ${countdown}s`}
        </span>
      </div>
      <button
        type="button"
        onClick={handleReconnect}
        disabled={reconnecting}
        className="px-3 py-1 text-xs font-semibold rounded-md bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white"
        aria-label="Reconnect now"
      >
        {reconnecting ? 'Connecting...' : 'Reconnect now'}
      </button>
    </div>
  )
}
