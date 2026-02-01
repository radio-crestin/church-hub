import { useCallback, useEffect, useRef, useState } from 'react'

import { getApiUrl } from '~/config'

export interface TranscriptionEntry {
  id: string
  text: string
  type: 'source' | 'translation'
  timestamp: number
}

export interface LiveTranslationState {
  isActive: boolean
  sourceLanguage: string
  targetLanguage: string
  inputAudioLevel: number
  outputAudioLevel: number
  transcription: TranscriptionEntry[]
  error?: string
  startedAt: number | null
}

export interface AudioDevice {
  id: number
  name: string
  inputChannels: number
  outputChannels: number
  isDefaultInput: boolean
  isDefaultOutput: boolean
  sampleRates: number[]
}

const LANGUAGES = [
  { code: 'ro', name: 'Romanian' },
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'it', name: 'Italian' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'pl', name: 'Polish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'ar', name: 'Arabic' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
] as const

const VOICES = [
  'Kore',
  'Puck',
  'Charon',
  'Fenrir',
  'Aoede',
  'Leda',
  'Orus',
  'Zephyr',
] as const

export { LANGUAGES, VOICES }

interface LiveTranslationSettings {
  sourceLanguage: string
  targetLanguage: string
  voiceName: string
  muteWhileSpeaking: boolean
  inputDeviceId: number | null
  outputDeviceId: number | null
}

const DEFAULT_SETTINGS: LiveTranslationSettings = {
  sourceLanguage: 'ro',
  targetLanguage: 'en',
  voiceName: 'Kore',
  muteWhileSpeaking: false,
  inputDeviceId: null,
  outputDeviceId: null,
}

export function useLiveTranslation() {
  const [state, setState] = useState<LiveTranslationState>({
    isActive: false,
    sourceLanguage: 'ro',
    targetLanguage: 'en',
    inputAudioLevel: 0,
    outputAudioLevel: 0,
    transcription: [],
    startedAt: null,
  })

  const [settings, setSettings] =
    useState<LiveTranslationSettings>(DEFAULT_SETTINGS)
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem('gemini-api-key') || '',
  )
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([])
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const baseUrl = getApiUrl() || ''

  // Load settings from server on mount
  useEffect(() => {
    fetch(`${baseUrl}/api/live-translation/settings`)
      .then((res) => res.json())
      .then((data: LiveTranslationSettings) => {
        setSettings({ ...DEFAULT_SETTINGS, ...data })
        setSettingsLoaded(true)
      })
      .catch(() => setSettingsLoaded(true))
  }, [baseUrl])

  // Load audio devices on mount
  useEffect(() => {
    fetch(`${baseUrl}/api/live-translation/devices`)
      .then((res) => res.json())
      .then(
        (data: {
          devices: AudioDevice[]
          defaultInputId: number
          defaultOutputId: number
        }) => {
          setAudioDevices(data.devices)
        },
      )
      .catch(() => {})
  }, [baseUrl])

  // Save API key to localStorage (never to server)
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('gemini-api-key', apiKey)
    }
  }, [apiKey])

  // Debounced save settings to server
  const saveSettings = useCallback(
    (newSettings: LiveTranslationSettings) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        fetch(`${baseUrl}/api/live-translation/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSettings),
        }).catch(() => {})
      }, 500)
    },
    [baseUrl],
  )

  const updateSetting = useCallback(
    <K extends keyof LiveTranslationSettings>(
      key: K,
      value: LiveTranslationSettings[K],
    ) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value }
        saveSettings(next)
        return next
      })
    },
    [saveSettings],
  )

  // Listen for WebSocket translation messages (state, levels, transcription)
  useEffect(() => {
    function handleMessage(event: Event) {
      const detail = (event as CustomEvent).detail
      if (!detail) return

      if (detail.type === 'translation_state') {
        setState(detail.payload)
      } else if (detail.type === 'translation_audio_level') {
        const { level, type } = detail.payload
        setState((prev) => ({
          ...prev,
          [type === 'input' ? 'inputAudioLevel' : 'outputAudioLevel']: level,
        }))
      } else if (detail.type === 'translation_transcription') {
        const action = detail.action as 'add' | 'update'
        const entry = detail.payload as TranscriptionEntry
        setState((prev) => {
          if (action === 'update') {
            const updated = prev.transcription.map((e) =>
              e.id === entry.id ? entry : e,
            )
            return { ...prev, transcription: updated }
          }
          return {
            ...prev,
            transcription: [...prev.transcription, entry].slice(-100),
          }
        })
      }
    }

    window.addEventListener('live-translation-message', handleMessage)
    return () =>
      window.removeEventListener('live-translation-message', handleMessage)
  }, [])

  const startTranslation = useCallback(async () => {
    if (!apiKey) return

    const res = await fetch(`${baseUrl}/api/live-translation/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceLanguage: settings.sourceLanguage,
        targetLanguage: settings.targetLanguage,
        voiceName: settings.voiceName,
        geminiApiKey: apiKey,
        muteWhileSpeaking: settings.muteWhileSpeaking,
        inputDeviceId: settings.inputDeviceId,
        outputDeviceId: settings.outputDeviceId,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      setState((prev) => ({ ...prev, error: err.error }))
      return
    }

    setState((prev) => ({
      ...prev,
      isActive: true,
      sourceLanguage: settings.sourceLanguage,
      targetLanguage: settings.targetLanguage,
      startedAt: Date.now(),
      error: undefined,
      transcription: [],
    }))
  }, [apiKey, baseUrl, settings])

  const stopTranslation = useCallback(async () => {
    await fetch(`${baseUrl}/api/live-translation/stop`, {
      method: 'POST',
    }).catch(() => {})

    setState((prev) => ({
      ...prev,
      isActive: false,
      inputAudioLevel: 0,
      outputAudioLevel: 0,
      startedAt: null,
    }))
  }, [baseUrl])

  const clearTranscription = useCallback(async () => {
    await fetch(`${baseUrl}/api/live-translation/clear`, {
      method: 'POST',
    }).catch(() => {})
    setState((prev) => ({ ...prev, transcription: [] }))
  }, [baseUrl])

  return {
    state,
    settings,
    apiKey,
    audioDevices,
    settingsLoaded,
    setApiKey,
    updateSetting,
    startTranslation,
    stopTranslation,
    clearTranscription,
  }
}
