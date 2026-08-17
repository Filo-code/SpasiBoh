/**
 * Text-to-speech.
 *
 * V1 uses the browser's built-in speech synthesis with `ru-RU`. No network
 * audio is required, which keeps the app fully usable offline. Quality varies
 * a lot by platform: iOS and Windows both ship decent Russian voices, some
 * Linux/Chrome setups ship none — `hasRussianVoice()` lets the UI say so
 * instead of silently playing an Italian voice mangling Cyrillic.
 */

let cachedVoices: SpeechSynthesisVoice[] = []
let voicesLoaded = false
const listeners = new Set<() => void>()

function synth(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  return window.speechSynthesis
}

export function isSpeechSupported(): boolean {
  return synth() !== null
}

function refreshVoices(): void {
  const engine = synth()
  if (!engine) return
  const voices = engine.getVoices()
  if (voices.length > 0) {
    cachedVoices = voices
    voicesLoaded = true
    listeners.forEach((listener) => listener())
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices()
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoices)
}

export function onVoicesChanged(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getVoices(): SpeechSynthesisVoice[] {
  if (!voicesLoaded) refreshVoices()
  return cachedVoices
}

export function getRussianVoices(): SpeechSynthesisVoice[] {
  return getVoices().filter((voice) => voice.lang.toLowerCase().startsWith('ru'))
}

export function hasRussianVoice(): boolean {
  return getRussianVoices().length > 0
}

/**
 * Picks the voice to use: the explicitly configured one if it still exists,
 * otherwise the first local Russian voice, otherwise any Russian voice.
 */
export function pickVoice(preferredURI: string | null): SpeechSynthesisVoice | null {
  const russian = getRussianVoices()
  if (preferredURI) {
    const exact = russian.find((voice) => voice.voiceURI === preferredURI)
    if (exact) return exact
  }
  const local = russian.find((voice) => voice.localService)
  return local ?? russian[0] ?? null
}

export interface SpeakOptions {
  rate?: number
  voiceURI?: string | null
  onEnd?: () => void
  onStart?: () => void
}

let currentUtterance: SpeechSynthesisUtterance | null = null

export function speak(text: string, options: SpeakOptions = {}): boolean {
  const engine = synth()
  if (!engine || !text.trim()) return false

  engine.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ru-RU'
  utterance.rate = options.rate ?? 0.95
  utterance.pitch = 1

  const voice = pickVoice(options.voiceURI ?? null)
  if (voice) utterance.voice = voice

  utterance.onstart = () => options.onStart?.()
  utterance.onend = () => {
    currentUtterance = null
    options.onEnd?.()
  }
  utterance.onerror = () => {
    currentUtterance = null
    options.onEnd?.()
  }

  currentUtterance = utterance
  engine.speak(utterance)
  return true
}

export function stopSpeaking(): void {
  const engine = synth()
  if (!engine) return
  engine.cancel()
  currentUtterance = null
}

export function isSpeaking(): boolean {
  return currentUtterance !== null
}
