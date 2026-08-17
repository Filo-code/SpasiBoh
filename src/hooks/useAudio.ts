import { useCallback, useEffect, useState } from 'react'
import {
  hasRussianVoice,
  isSpeechSupported,
  onVoicesChanged,
  speak,
  stopSpeaking,
} from '@/services/speech'
import { useAppStore } from '@/store/appStore'

export type PlaybackSpeed = 'normal' | 'slow'

/**
 * Audio playback bound to the user's voice/rate settings.
 * `speaking` tracks which speed is currently playing so the buttons can show
 * an active state.
 */
export function useAudio() {
  const settings = useAppStore((state) => state.settings)
  const [speaking, setSpeaking] = useState<PlaybackSpeed | null>(null)
  const [voiceReady, setVoiceReady] = useState(() => hasRussianVoice())

  useEffect(() => {
    return onVoicesChanged(() => setVoiceReady(hasRussianVoice()))
  }, [])

  useEffect(() => () => stopSpeaking(), [])

  const play = useCallback(
    (text: string, speed: PlaybackSpeed = 'normal') => {
      if (!text) return
      const rate = speed === 'slow' ? settings.slowSpeechRate : settings.speechRate
      setSpeaking(speed)
      const started = speak(text, {
        rate,
        voiceURI: settings.voiceURI,
        onEnd: () => setSpeaking(null),
      })
      if (!started) setSpeaking(null)
    },
    [settings.slowSpeechRate, settings.speechRate, settings.voiceURI],
  )

  const stop = useCallback(() => {
    stopSpeaking()
    setSpeaking(null)
  }, [])

  return {
    play,
    stop,
    speaking,
    supported: isSpeechSupported(),
    /** False when the device has no Russian voice installed. */
    hasRussianVoice: voiceReady,
  }
}
