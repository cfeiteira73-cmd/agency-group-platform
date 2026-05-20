'use client'
// AGENCY GROUP — SH-ROS Control Tower: DLQ Replay Button | AMI: 22506
// Supports both global DLQ replay and per-event replay (eventId prop)

import { useState } from 'react'

type ReplayState = 'idle' | 'loading' | 'success' | 'error'

interface ReplayButtonProps {
  /** If provided, replay this specific event ID. Omit for global DLQ replay. */
  eventId?: string
}

export function ReplayButton({ eventId }: ReplayButtonProps) {
  const [state, setState] = useState<ReplayState>('idle')
  const [message, setMessage] = useState<string>('')

  async function handleReplay() {
    setState('loading')
    setMessage('')
    try {
      const body = eventId ? JSON.stringify({ event_id: eventId }) : undefined
      const res  = await fetch('/api/control-tower/dlq', {
        method:  'POST',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body,
      })
      const data = await res.json() as { triggered?: boolean; result?: unknown; error?: string }
      if (res.ok && data.triggered) {
        setState('success')
        setMessage(eventId ? 'Event replayed' : 'DLQ replay triggered')
      } else {
        setState('error')
        setMessage(data.error ?? 'Replay failed')
      }
    } catch {
      setState('error')
      setMessage('Network error')
    } finally {
      setTimeout(() => { setState('idle'); setMessage('') }, 4000)
    }
  }

  const label =
    state === 'loading' ? 'Replaying…'
    : state === 'success' ? 'Triggered ✓'
    : state === 'error'   ? 'Failed'
    : eventId ? 'Replay' : 'Replay DLQ'

  const colorClass =
    state === 'success' ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
    : state === 'error'   ? 'bg-red-700 hover:bg-red-600 text-white'
    : state === 'loading' ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
    : eventId
      ? 'bg-amber-900 hover:bg-amber-800 text-amber-200 border border-amber-700'
      : 'bg-orange-700 hover:bg-orange-600 text-white'

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleReplay}
        disabled={state === 'loading'}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${colorClass}`}
      >
        {label}
      </button>
      {message && (
        <p className={`text-[10px] font-mono ${state === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
