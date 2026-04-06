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

export type OutputMode = 'device' | 'webrtc' | 'both'

interface LiveTranslationSettings {
  sourceLanguage: string
  targetLanguage: string
  voiceName: string
  inputDeviceId: number | null
  outputDeviceId: number | null
  geminiApiKey: string
  outputMode: OutputMode
}

const DEFAULT_SETTINGS: LiveTranslationSettings = {
  sourceLanguage: 'ro',
  targetLanguage: 'en',
  voiceName: 'Kore',
  inputDeviceId: null,
  outputDeviceId: null,
  geminiApiKey: '',
  outputMode: 'device',
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
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([])
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [streamSecret, setStreamSecret] = useState<string>('')
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const baseUrl = getApiUrl() || ''

  // Load settings from server on mount (includes API key)
  useEffect(() => {
    fetch(`${baseUrl}/api/live-translation/settings`)
      .then((res) => res.json())
      .then((data: LiveTranslationSettings) => {
        // Migrate from localStorage if server has no key
        const migratedKey =
          data.geminiApiKey || localStorage.getItem('gemini-api-key') || ''
        const merged = {
          ...DEFAULT_SETTINGS,
          ...data,
          geminiApiKey: migratedKey,
        }
        setSettings(merged)
        setSettingsLoaded(true)
        // If we migrated from localStorage, save to server and clean up
        if (!data.geminiApiKey && migratedKey) {
          fetch(`${baseUrl}/api/live-translation/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(merged),
          }).then(() => localStorage.removeItem('gemini-api-key'))
        }
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
          setAudioDevices(Array.isArray(data.devices) ? data.devices : [])
        },
      )
      .catch(() => {})
  }, [baseUrl])

  // Load stream secret on mount
  useEffect(() => {
    fetch(`${baseUrl}/api/live-translation/stream-secret`)
      .then((res) => res.json())
      .then((data: { secret: string }) => setStreamSecret(data.secret))
      .catch(() => {})
  }, [baseUrl])

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

  // Convenience accessor for apiKey
  const apiKey = settings.geminiApiKey
  const setApiKey = useCallback(
    (key: string) => updateSetting('geminiApiKey', key),
    [updateSetting],
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
        inputDeviceId: settings.inputDeviceId,
        outputDeviceId: settings.outputDeviceId,
        outputMode: settings.outputMode,
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

  const resetSecret = useCallback(async () => {
    const res = await fetch(
      `${baseUrl}/api/live-translation/stream-secret/reset`,
      {
        method: 'POST',
      },
    )
    if (res.ok) {
      const data = await res.json()
      setStreamSecret(data.secret)
    }
  }, [baseUrl])

  const streamUrl = streamSecret
    ? `https://churchub-backend.radiocrestin.ro/listen/${streamSecret}`
    : ''

  return {
    state,
    settings,
    apiKey,
    audioDevices,
    settingsLoaded,
    streamUrl,
    streamSecret,
    setApiKey,
    updateSetting,
    startTranslation,
    stopTranslation,
    clearTranscription,
    resetSecret,
  }
}
