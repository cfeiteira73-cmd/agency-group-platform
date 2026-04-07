'use client'
import { useEffect, useState } from 'react'

export function PushNotificationSetup() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Check if already dismissed this session
    if (sessionStorage.getItem('push-dismissed')) {
      setDismissed(true)
      return
    }
    if ('Notification' in window) {
      setPermission(Notification.permission)
      if (Notification.permission === 'granted') {
        checkSubscription()
      }
    }
  }, [])

  async function checkSubscription() {
    if (!('serviceWorker' in navigator)) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    } catch {
      // Service worker not ready
    }
  }

  async function subscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Push] Push notifications are not supported in this browser')
      return
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      console.warn('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set')
      return
    }

    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)

      if (perm !== 'granted') {
        setLoading(false)
        return
      }

      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })

      if (res.ok) {
        setSubscribed(true)
      }
    } catch (error) {
      console.error('[Push] Subscription error:', error)
    } finally {
      setLoading(false)
    }
  }

  function dismiss() {
    sessionStorage.setItem('push-dismissed', '1')
    setDismissed(true)
  }

  // Don't show if: already subscribed, permission denied, dismissed, or push not supported
  if (
    subscribed ||
    permission === 'denied' ||
    dismissed ||
    (typeof window !== 'undefined' && !('PushManager' in window))
  ) {
    return null
  }

  return (
    <div
      role="banner"
      aria-label="Enable push notifications"
      style={{
        position: 'fixed',
        bottom: '80px',
        right: '24px',
        background: '#0c1f15',
        border: '1px solid rgba(201,169,110,0.3)',
        padding: '16px 20px',
        maxWidth: '300px',
        zIndex: 900,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          position: 'absolute',
          top: '8px',
          right: '10px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'rgba(244,240,230,0.4)',
          fontSize: '0.9rem',
          lineHeight: 1,
          padding: '2px 4px',
        }}
      >
        ×
      </button>

      <p
        style={{
          fontFamily: "'Jost', sans-serif",
          fontSize: '0.85rem',
          color: '#f4f0e6',
          margin: '0 0 12px',
          lineHeight: 1.5,
          paddingRight: '16px',
        }}
      >
        🔔 Activar notificações para alertas de novos leads, visitas e deals
      </p>

      <button
        onClick={subscribe}
        disabled={loading}
        style={{
          width: '100%',
          padding: '10px',
          background: loading ? 'rgba(201,169,110,0.5)' : '#c9a96e',
          color: '#0c1f15',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: "'DM Mono', monospace",
          fontSize: '0.7rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          fontWeight: 700,
          transition: 'background 0.2s',
        }}
      >
        {loading ? 'A activar...' : 'Activar Notificações'}
      </button>
    </div>
  )
}

// ─── Helper: Convert VAPID public key to Uint8Array ──────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length))
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
