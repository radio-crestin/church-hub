import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getApiUrl } from '~/config'

export interface TranscriptionEntry {
  id: string
  text: string
  type: 'source' | 'translation'
  targetId?: string
  targetLanguage?: string
  timestamp: number
}

export interface TargetState {
  id: string
  targetLanguage: string
  outputAudioLevel: number
  listenerCount: number
}

export interface LiveTranslationState {
  isActive: boolean
  sourceLanguage: string
  inputAudioLevel: number
  outputAudioLevel: number
  transcription: TranscriptionEntry[]
  targets: TargetState[]
  primaryTargetId?: string
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

export { LANGUAGES }

export type OutputMode = 'device' | 'webrtc' | 'both'

export interface TranslationTarget {
  id: string
  targetLanguage: string
}

export interface LiveTranslationSettings {
  sourceLanguage: string
  targets: TranslationTarget[]
  primaryTargetId?: string
  geminiApiKey: string
  inputDeviceId: number | null
  outputDeviceId: number | null
  outputMode: OutputMode
}

function genTargetId(): string {
  return `tgt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const DEFAULT_TARGET: TranslationTarget = {
  id: 'placeholder',
  targetLanguage: 'en',
}

const DEFAULT_SETTINGS: LiveTranslationSettings = {
  sourceLanguage: 'ro',
  targets: [DEFAULT_TARGET],
  geminiApiKey: '',
  inputDeviceId: null,
  outputDeviceId: null,
  outputMode: 'device',
}

const DEFAULT_STATE: LiveTranslationState = {
  isActive: false,
  sourceLanguage: 'ro',
  inputAudioLevel: 0,
  outputAudioLevel: 0,
  transcription: [],
  targets: [],
  startedAt: null,
}

export function useLiveTranslation() {
  const [state, setState] = useState<LiveTranslationState>(DEFAULT_STATE)
  const [settings, setSettings] =
    useState<LiveTranslationSettings>(DEFAULT_SETTINGS)
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([])
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [streamSecret, setStreamSecret] = useState<string>('')
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const baseUrl = getApiUrl() || ''

  useEffect(() => {
    fetch(`${baseUrl}/api/live-translation/settings`)
      .then((res) => res.json())
      .then((data: Partial<LiveTranslationSettings>) => {
        // Migrate legacy gemini-api-key in localStorage
        const lsKey = localStorage.getItem('gemini-api-key') || ''
        const targets =
          Array.isArray(data.targets) && data.targets.length > 0
            ? data.targets
            : [{ ...DEFAULT_TARGET, id: genTargetId() }]
        const merged: LiveTranslationSettings = {
          ...DEFAULT_SETTINGS,
          ...data,
          targets,
          primaryTargetId: data.primaryTargetId || targets[0]?.id,
          geminiApiKey: data.geminiApiKey || lsKey,
        }
        setSettings(merged)
        setSettingsLoaded(true)
        if (!data.geminiApiKey && lsKey) {
          fetch(`${baseUrl}/api/live-translation/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(merged),
          }).then(() => localStorage.removeItem('gemini-api-key'))
        }
      })
      .catch(() => setSettingsLoaded(true))
  }, [baseUrl])

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

  useEffect(() => {
    fetch(`${baseUrl}/api/live-translation/stream-secret`)
      .then((res) => res.json())
      .then((data: { secret: string }) => setStreamSecret(data.secret))
      .catch(() => {})
  }, [baseUrl])

  const saveSettings = useCallback(
    (next: LiveTranslationSettings) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        fetch(`${baseUrl}/api/live-translation/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
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

  const addTarget = useCallback(
    (targetLanguage = 'en') => {
      setSettings((prev) => {
        if (prev.targets.some((t) => t.targetLanguage === targetLanguage)) {
          return prev
        }
        const newTarget: TranslationTarget = {
          id: genTargetId(),
          targetLanguage,
        }
        const next = { ...prev, targets: [...prev.targets, newTarget] }
        saveSettings(next)
        return next
      })
    },
    [saveSettings],
  )

  const removeTarget = useCallback(
    (id: string) => {
      setSettings((prev) => {
        if (prev.targets.length <= 1) return prev
        const targets = prev.targets.filter((t) => t.id !== id)
        const primaryTargetId =
          prev.primaryTargetId === id ? targets[0]?.id : prev.primaryTargetId
        const next = { ...prev, targets, primaryTargetId }
        saveSettings(next)
        return next
      })
    },
    [saveSettings],
  )

  const updateTarget = useCallback(
    (id: string, patch: Partial<Omit<TranslationTarget, 'id'>>) => {
      setSettings((prev) => {
        const targets = prev.targets.map((t) =>
          t.id === id ? { ...t, ...patch } : t,
        )
        const next = { ...prev, targets }
        saveSettings(next)
        return next
      })
    },
    [saveSettings],
  )

  const setPrimaryTarget = useCallback(
    (id: string) => {
      updateSetting('primaryTargetId', id)
    },
    [updateSetting],
  )

  // WebSocket listeners
  useEffect(() => {
    function handleMessage(event: Event) {
      const detail = (event as CustomEvent).detail
      if (!detail) return

      if (detail.type === 'translation_state') {
        setState(detail.payload)
      } else if (detail.type === 'translation_audio_level') {
        const { level, type, targetId } = detail.payload
        setState((prev) => {
          if (type === 'input') {
            return { ...prev, inputAudioLevel: level }
          }
          // output: update per-target level + top-level if primary
          const targets = prev.targets.map((t) =>
            t.id === targetId ? { ...t, outputAudioLevel: level } : t,
          )
          const outputAudioLevel =
            !prev.primaryTargetId || prev.primaryTargetId === targetId
              ? level
              : prev.outputAudioLevel
          return { ...prev, targets, outputAudioLevel }
        })
      } else if (detail.type === 'translation_transcription') {
        const action = detail.action as 'add' | 'update'
        const entry = detail.payload as TranscriptionEntry
        setState((prev) => {
          if (action === 'update') {
            return {
              ...prev,
              transcription: prev.transcription.map((e) =>
                e.id === entry.id ? entry : e,
              ),
            }
          }
          return {
            ...prev,
            transcription: [...prev.transcription, entry].slice(-200),
          }
        })
      }
    }

    window.addEventListener('live-translation-message', handleMessage)
    return () =>
      window.removeEventListener('live-translation-message', handleMessage)
  }, [])

  const apiKey = settings.geminiApiKey

  const canStart =
    apiKey.length > 0 && settings.targets.length > 0 && !state.isActive

  const startTranslation = useCallback(async () => {
    if (!canStart) return
    const res = await fetch(`${baseUrl}/api/live-translation/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceLanguage: settings.sourceLanguage,
        targets: settings.targets,
        primaryTargetId: settings.primaryTargetId,
        geminiApiKey: settings.geminiApiKey,
        inputDeviceId: settings.inputDeviceId,
        outputDeviceId: settings.outputDeviceId,
        outputMode: settings.outputMode,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }))
      setState((prev) => ({ ...prev, error: err.error }))
      return
    }

    setState((prev) => ({
      ...prev,
      isActive: true,
      sourceLanguage: settings.sourceLanguage,
      primaryTargetId: settings.primaryTargetId,
      startedAt: Date.now(),
      error: undefined,
      transcription: [],
      targets: settings.targets.map((t) => ({
        id: t.id,
        targetLanguage: t.targetLanguage,
        outputAudioLevel: 0,
        listenerCount: 0,
      })),
    }))
  }, [baseUrl, canStart, settings])

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
      { method: 'POST' },
    )
    if (res.ok) {
      const data = await res.json()
      setStreamSecret(data.secret)
    }
  }, [baseUrl])

  const streamUrl = useMemo(
    () =>
      streamSecret
        ? `https://churchub-backend.radiocrestin.ro/listen/${streamSecret}`
        : '',
    [streamSecret],
  )

  return {
    state,
    settings,
    settingsLoaded,
    apiKey,
    audioDevices,
    streamUrl,
    streamSecret,
    canStart,
    updateSetting,
    addTarget,
    removeTarget,
    updateTarget,
    setPrimaryTarget,
    startTranslation,
    stopTranslation,
    clearTranscription,
    resetSecret,
  }
}
