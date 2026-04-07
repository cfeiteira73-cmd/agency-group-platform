'use client'

import { useCallback, useRef, useState } from 'react'

// Strip markdown for clean speech output
function cleanForSpeech(text: string): string {
  return text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\|.*?\|/g, '') // strip tables
    .replace(/[-]{3,}/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
}

export function useSofiaVoice() {
  const [speaking, setSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const stopSpeaking = useCallback(() => {
    // Stop OpenAI audio if playing
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    // Stop browser TTS if speaking
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    utteranceRef.current = null
    setSpeaking(false)
  }, [])

  const speak = useCallback(async (text: string) => {
    if (!voiceEnabled || !text.trim()) return
    stopSpeaking()

    const cleanText = cleanForSpeech(text)
    if (!cleanText) return

    setSpeaking(true)

    // Try OpenAI TTS first (higher quality)
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, voice: 'nova' }),
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audioRef.current = audio
        audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); audioRef.current = null }
        audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); audioRef.current = null }
        await audio.play()
        return
      }
    } catch {
      // Fall through to browser TTS
    }

    // Fallback: browser Web Speech API (free, no API key needed)
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSpeaking(false)
      return
    }

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utteranceRef.current = utterance

    // Pick a Portuguese or female voice if available
    const voices = window.speechSynthesis.getVoices()
    const ptVoice = voices.find(v => v.lang.startsWith('pt')) ||
                    voices.find(v => v.name.toLowerCase().includes('female')) ||
                    voices[0]
    if (ptVoice) utterance.voice = ptVoice
    utterance.lang = 'pt-PT'
    utterance.rate = 1.0
    utterance.pitch = 1.1

    utterance.onend = () => { setSpeaking(false); utteranceRef.current = null }
    utterance.onerror = () => { setSpeaking(false); utteranceRef.current = null }

    window.speechSynthesis.speak(utterance)
  }, [voiceEnabled, stopSpeaking])

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      if (prev) stopSpeaking()
      return !prev
    })
  }, [stopSpeaking])

  return { speak, stopSpeaking, toggleVoice, speaking, voiceEnabled }
}
