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

    const doSpeak = (voices: SpeechSynthesisVoice[]) => {
      // Chrome bug: cancel + small delay before speaking
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(cleanText)
      utteranceRef.current = utterance

      const ptVoice = voices.find(v => v.lang === 'pt-PT') ||
                      voices.find(v => v.lang.startsWith('pt')) ||
                      voices.find(v => v.lang.startsWith('en')) ||
                      voices[0]
      if (ptVoice) utterance.voice = ptVoice
      utterance.lang = ptVoice?.lang || 'pt-PT'
      utterance.rate = 1.05
      utterance.pitch = 1.1
      utterance.volume = 1.0

      utterance.onend = () => { setSpeaking(false); utteranceRef.current = null }
      utterance.onerror = () => { setSpeaking(false); utteranceRef.current = null }

      // Chrome requires a tiny delay after cancel()
      setTimeout(() => {
        window.speechSynthesis.speak(utterance)
        // Chrome sometimes pauses itself — resume it
        setTimeout(() => window.speechSynthesis.resume(), 100)
      }, 50)
    }

    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      doSpeak(voices)
    } else {
      // Voices not loaded yet — wait for them
      window.speechSynthesis.onvoiceschanged = () => {
        const v = window.speechSynthesis.getVoices()
        window.speechSynthesis.onvoiceschanged = null
        doSpeak(v)
      }
    }
  }, [voiceEnabled, stopSpeaking])

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      if (prev) {
        stopSpeaking()
      } else {
        // Unlock browser speechSynthesis on user gesture — Chrome requires this
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel()
          const unlock = new SpeechSynthesisUtterance(' ')
          unlock.volume = 0
          window.speechSynthesis.speak(unlock)
        }
      }
      return !prev
    })
  }, [stopSpeaking])

  return { speak, stopSpeaking, toggleVoice, speaking, voiceEnabled }
}
