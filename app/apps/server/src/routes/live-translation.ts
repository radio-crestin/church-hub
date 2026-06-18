import type { RequestContext } from '../middleware'
import { getAudioDevices } from '../service/live-translation/audio-io'
import {
  defaultSettings,
  generateTargetId,
  migrateSettings,
  type PersistedSettings,
} from '../service/live-translation/migrate-settings'
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
  broadcastTextForTarget,
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

// Last-broadcast snapshot per target — lets us send true deltas to listeners
// instead of full-entry snapshots, so the listener can append and decide on
// its own when to roll over to a new line.
const lastBroadcastByTarget = new Map<
  string,
  { entryId: string; text: string }
>()

setTranscriptionCallback((entry, action) => {
  broadcastTranslationTranscription(entry, action)
  if (entry.type !== 'translation' || !entry.targetId) return

  const prev = lastBroadcastByTarget.get(entry.targetId)
  let delta = ''
  if (!prev || prev.entryId !== entry.id) {
    // New entry — its full text is the delta
    delta = entry.text
  } else if (entry.text.length > prev.text.length) {
    // Same entry, grew — broadcast only what was added
    delta = entry.text.slice(prev.text.length)
  }
  if (delta) {
    broadcastTextForTarget(entry.targetId, delta, entry.id, action)
  }
  lastBroadcastByTarget.set(entry.targetId, {
    entryId: entry.id,
    text: entry.text,
  })
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

      const targets: TranslationTarget[] =
        Array.isArray(body.targets) && body.targets.length > 0
          ? body.targets.map((t) => ({
              id: t.id || generateTargetId(),
              targetLanguage: t.targetLanguage,
            }))
          : saved.targets

      if (!targets || targets.length === 0) {
        return Response.json(
          { error: 'At least one target language is required' },
          { status: 400 },
        )
      }

      const geminiApiKey = body.geminiApiKey || saved.geminiApiKey
      if (!geminiApiKey) {
        return Response.json(
          { error: 'Gemini API key is required' },
          { status: 400 },
        )
      }

      const config: LiveTranslationConfig = {
        sourceLanguage: body.sourceLanguage || saved.sourceLanguage,
        targets,
        primaryTargetId:
          body.primaryTargetId || saved.primaryTargetId || targets[0]?.id,
        geminiApiKey,
        inputDeviceId: body.inputDeviceId ?? saved.inputDeviceId ?? undefined,
        outputDeviceId:
          body.outputDeviceId ?? saved.outputDeviceId ?? undefined,
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
