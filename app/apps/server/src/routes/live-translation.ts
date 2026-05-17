import type { RequestContext } from '../middleware'
import { getAudioDevices } from '../service/live-translation/audio-io'
import { defaultVoiceForEngine } from '../service/live-translation/engines'
import {
  clearTranscription,
  getTranslationState,
  setAudioLevelCallback,
  setAudioOutputCallback,
  setStateCallback,
  setTranscriptionCallback,
  startTranslation,
  stopTranslation,
  updateListenerCounts,
} from '../service/live-translation/session'
import {
  broadcastAudioForTarget,
  getListenerCount,
  getListenerCountsByTarget,
  getStreamSecret,
  resetStreamSecret,
  setAvailableLanguages,
  setListenerCountsCallback,
  startSignalingRelay,
  stopSignalingRelay,
} from '../service/live-translation/stream'
import type {
  LiveTranslationConfig,
  TranslationEngine,
  TranslationTarget,
} from '../service/live-translation/types'
import { getSetting, upsertSetting } from '../service/settings'
import { log } from '../utils/fileLogger'
import {
  broadcastTranslationAudioLevel,
  broadcastTranslationAudioOutput,
  broadcastTranslationState,
  broadcastTranslationTranscription,
} from '../websocket'

const logger = {
  info: (msg: string, data?: unknown) =>
    log('live-translation-route', 'info', msg, data),
  error: (msg: string, data?: unknown) =>
    log('live-translation-route', 'error', msg, data),
}

setStateCallback((state) => {
  broadcastTranslationState(state)
})

setAudioOutputCallback((targetId, pcmData) => {
  broadcastTranslationAudioOutput(targetId, pcmData)
  broadcastAudioForTarget(targetId, pcmData)
})

setTranscriptionCallback((entry, action) => {
  broadcastTranslationTranscription(entry, action)
})

setAudioLevelCallback((level, type, targetId) => {
  broadcastTranslationAudioLevel(level, type, targetId)
})

setListenerCountsCallback((counts) => {
  updateListenerCounts(counts)
})

export async function handleLiveTranslationRoutes(
  req: Request,
  url: URL,
  _context: RequestContext,
): Promise<Response | null> {
  if (req.method === 'GET' && url.pathname === '/api/live-translation/state') {
    return Response.json(getTranslationState())
  }

  if (req.method === 'POST' && url.pathname === '/api/live-translation/start') {
    return handleStart(req)
  }

  if (req.method === 'POST' && url.pathname === '/api/live-translation/stop') {
    return handleStop()
  }

  if (req.method === 'POST' && url.pathname === '/api/live-translation/clear') {
    clearTranscription()
    return Response.json({ success: true })
  }

  if (
    req.method === 'GET' &&
    url.pathname === '/api/live-translation/devices'
  ) {
    try {
      return Response.json(await getAudioDevices())
    } catch (error) {
      logger.error('Failed to get audio devices', { error: String(error) })
      return Response.json({
        devices: [],
        defaultInputId: -1,
        defaultOutputId: -1,
      })
    }
  }

  if (
    req.method === 'GET' &&
    url.pathname === '/api/live-translation/settings'
  ) {
    return handleGetSettings()
  }

  if (
    req.method === 'PUT' &&
    url.pathname === '/api/live-translation/settings'
  ) {
    return handleSaveSettings(req)
  }

  if (
    req.method === 'GET' &&
    url.pathname === '/api/live-translation/stream-secret'
  ) {
    return Response.json({ secret: getStreamSecret() })
  }

  if (
    req.method === 'POST' &&
    url.pathname === '/api/live-translation/stream-secret/reset'
  ) {
    return Response.json({ secret: resetStreamSecret() })
  }

  if (
    req.method === 'GET' &&
    url.pathname === '/api/live-translation/stream-info'
  ) {
    return Response.json({
      listeners: getListenerCount(),
      countsByTarget: getListenerCountsByTarget(),
    })
  }

  return null
}

const SETTINGS_KEY = 'live_translation_settings'

interface PersistedSettings {
  engine: TranslationEngine
  sourceLanguage: string
  targets: TranslationTarget[]
  primaryTargetId?: string
  geminiApiKey?: string
  openaiApiKey?: string
  inputDeviceId?: number | null
  outputDeviceId?: number | null
  outputMode?: 'device' | 'webrtc' | 'both'
}

function generateTargetId(): string {
  return `tgt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function defaultSettings(): PersistedSettings {
  return {
    engine: 'openai',
    sourceLanguage: 'ro',
    targets: [
      {
        id: generateTargetId(),
        targetLanguage: 'en',
        voiceName: defaultVoiceForEngine('openai'),
      },
    ],
    geminiApiKey: '',
    openaiApiKey: '',
    inputDeviceId: null,
    outputDeviceId: null,
    outputMode: 'device',
  }
}

/**
 * Migrate legacy single-target settings shape:
 *   { sourceLanguage, targetLanguage, voiceName, geminiApiKey, ... }
 * into the new multi-target shape with targets[].
 */
function migrateSettings(raw: unknown): PersistedSettings {
  const obj = (raw as Record<string, unknown>) || {}
  const defaults = defaultSettings()

  const engine: TranslationEngine =
    obj.engine === 'gemini' || obj.engine === 'openai'
      ? obj.engine
      : defaults.engine

  let targets: TranslationTarget[]
  if (Array.isArray(obj.targets) && obj.targets.length > 0) {
    targets = (obj.targets as Array<Record<string, unknown>>).map((t) => ({
      id: typeof t.id === 'string' ? t.id : generateTargetId(),
      targetLanguage:
        typeof t.targetLanguage === 'string' ? t.targetLanguage : 'en',
      voiceName:
        typeof t.voiceName === 'string'
          ? t.voiceName
          : defaultVoiceForEngine(engine),
    }))
  } else {
    // Legacy shape: single targetLanguage + voiceName
    targets = [
      {
        id: generateTargetId(),
        targetLanguage:
          typeof obj.targetLanguage === 'string' ? obj.targetLanguage : 'en',
        voiceName:
          typeof obj.voiceName === 'string'
            ? obj.voiceName
            : defaultVoiceForEngine(engine),
      },
    ]
  }

  return {
    engine,
    sourceLanguage:
      typeof obj.sourceLanguage === 'string' ? obj.sourceLanguage : 'ro',
    targets,
    primaryTargetId:
      typeof obj.primaryTargetId === 'string'
        ? obj.primaryTargetId
        : targets[0]?.id,
    geminiApiKey:
      typeof obj.geminiApiKey === 'string' ? obj.geminiApiKey : undefined,
    openaiApiKey:
      typeof obj.openaiApiKey === 'string' ? obj.openaiApiKey : undefined,
    inputDeviceId:
      typeof obj.inputDeviceId === 'number' ? obj.inputDeviceId : null,
    outputDeviceId:
      typeof obj.outputDeviceId === 'number' ? obj.outputDeviceId : null,
    outputMode:
      obj.outputMode === 'device' ||
      obj.outputMode === 'webrtc' ||
      obj.outputMode === 'both'
        ? obj.outputMode
        : defaults.outputMode,
  }
}

function loadPersistedSettings(): PersistedSettings {
  const saved = getSetting('app_settings', SETTINGS_KEY)
  if (!saved) return defaultSettings()
  try {
    return migrateSettings(JSON.parse(saved.value))
  } catch {
    return defaultSettings()
  }
}

function handleGetSettings(): Response {
  return Response.json(loadPersistedSettings())
}

function handleSaveSettings(req: Request): Response {
  const savePromise = (async () => {
    try {
      const body = await req.json()
      const migrated = migrateSettings(body)
      upsertSetting('app_settings', {
        key: SETTINGS_KEY,
        value: JSON.stringify(migrated),
      })
      return Response.json({ success: true, settings: migrated })
    } catch (error) {
      logger.error('Failed to save settings', { error: String(error) })
      return Response.json({ error: String(error) }, { status: 500 })
    }
  })()
  return savePromise as unknown as Response
}

function handleStart(req: Request): Response {
  const startPromise = (async () => {
    try {
      const body = (await req.json()) as Partial<LiveTranslationConfig>
      const saved = loadPersistedSettings()

      const engine: TranslationEngine =
        body.engine === 'gemini' || body.engine === 'openai'
          ? body.engine
          : saved.engine

      const targets: TranslationTarget[] =
        Array.isArray(body.targets) && body.targets.length > 0
          ? body.targets.map((t) => ({
              id: t.id || generateTargetId(),
              targetLanguage: t.targetLanguage,
              voiceName: t.voiceName || defaultVoiceForEngine(engine),
            }))
          : saved.targets

      if (!targets || targets.length === 0) {
        return Response.json(
          { error: 'At least one target language is required' },
          { status: 400 },
        )
      }

      const geminiApiKey = body.geminiApiKey || saved.geminiApiKey
      const openaiApiKey = body.openaiApiKey || saved.openaiApiKey

      const apiKey = engine === 'gemini' ? geminiApiKey : openaiApiKey
      if (!apiKey) {
        return Response.json(
          {
            error: `${engine === 'gemini' ? 'Gemini' : 'OpenAI'} API key is required`,
          },
          { status: 400 },
        )
      }

      const config: LiveTranslationConfig = {
        engine,
        sourceLanguage: body.sourceLanguage || saved.sourceLanguage,
        targets,
        primaryTargetId:
          body.primaryTargetId || saved.primaryTargetId || targets[0]?.id,
        geminiApiKey,
        openaiApiKey,
        inputDeviceId:
          body.inputDeviceId ?? (saved.inputDeviceId ?? undefined),
        outputDeviceId:
          body.outputDeviceId ?? (saved.outputDeviceId ?? undefined),
        outputMode: body.outputMode ?? saved.outputMode ?? 'device',
      }

      // Publish target languages to listeners BEFORE starting the relay
      setAvailableLanguages(
        targets.map((t) => ({ targetId: t.id, code: t.targetLanguage })),
      )

      await startTranslation(config)

      // Always start the signaling relay — listeners use a single link
      // regardless of outputMode. (Device-only output still allows external
      // listeners to connect to the configured target languages.)
      await startSignalingRelay()

      logger.info('Translation started', {
        engine: config.engine,
        source: config.sourceLanguage,
        targets: config.targets.map((t) => t.targetLanguage),
        outputMode: config.outputMode,
      })

      return Response.json({ success: true })
    } catch (error) {
      logger.error('Failed to start translation', { error: String(error) })
      return Response.json({ error: String(error) }, { status: 500 })
    }
  })()
  return startPromise as unknown as Response
}

function handleStop(): Response {
  const stopPromise = (async () => {
    try {
      await stopSignalingRelay()
      await stopTranslation()
      setAvailableLanguages([])
      logger.info('Translation stopped')
      return Response.json({ success: true })
    } catch (error) {
      logger.error('Failed to stop translation', { error: String(error) })
      return Response.json({ error: String(error) }, { status: 500 })
    }
  })()
  return stopPromise as unknown as Response
}
