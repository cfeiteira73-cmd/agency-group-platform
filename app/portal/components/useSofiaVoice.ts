'use client'

import { useCallback, useRef, useState } from 'react'

export function useSofiaVoice() {
  const [speaking, setSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const speak = useCallback(async (text: string) => {
    if (!voiceEnabled || !text.trim()) return

    // Stop any current speech
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    // Strip markdown for cleaner speech
    const cleanText = text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/\n+/g, ' ')
      .slice(0, 500) // Max 500 chars for TTS

    if (!cleanText.trim()) return

    setSpeaking(true)
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, voice: 'nova' }),
      })

      if (!res.ok) return

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio

      audio.onended = () => {
        setSpeaking(false)
        URL.revokeObjectURL(url)
        audioRef.current = null
      }
      audio.onerror = () => {
        setSpeaking(false)
        URL.revokeObjectURL(url)
        audioRef.current = null
      }

      await audio.play()
    } catch {
      setSpeaking(false)
    }
  }, [voiceEnabled])

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setSpeaking(false)
  }, [])

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      if (prev) stopSpeaking()
      return !prev
    })
  }, [stopSpeaking])

  return { speak, stopSpeaking, toggleVoice, speaking, voiceEnabled }
}
