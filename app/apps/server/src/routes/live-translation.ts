import type { RequestContext } from '../middleware'
import { getAudioDevices } from '../service/live-translation/audio-io'
import {
  clearTranscription,
  getTranslationState,
  setAudioLevelCallback,
  setAudioOutputCallback,
  setStateCallback,
  setTranscriptionCallback,
  startTranslation,
  stopTranslation,
} from '../service/live-translation/session'
import type { LiveTranslationConfig } from '../service/live-translation/types'
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

// Register callbacks to broadcast via WebSocket
setStateCallback((state) => {
  broadcastTranslationState(state)
})

setAudioOutputCallback((pcmData) => {
  broadcastTranslationAudioOutput(pcmData)
})

setTranscriptionCallback((entry, action) => {
  broadcastTranslationTranscription(entry, action)
})

setAudioLevelCallback((level, type) => {
  broadcastTranslationAudioLevel(level, type)
})

export async function handleLiveTranslationRoutes(
  req: Request,
  url: URL,
  _context: RequestContext,
): Promise<Response | null> {
  // GET /api/live-translation/state
  if (req.method === 'GET' && url.pathname === '/api/live-translation/state') {
    return Response.json(getTranslationState())
  }

  // POST /api/live-translation/start
  if (req.method === 'POST' && url.pathname === '/api/live-translation/start') {
    return handleStart(req)
  }

  // POST /api/live-translation/stop
  if (req.method === 'POST' && url.pathname === '/api/live-translation/stop') {
    return handleStop()
  }

  // POST /api/live-translation/clear
  if (req.method === 'POST' && url.pathname === '/api/live-translation/clear') {
    clearTranscription()
    return Response.json({ success: true })
  }

  // GET /api/live-translation/devices
  if (
    req.method === 'GET' &&
    url.pathname === '/api/live-translation/devices'
  ) {
    return Response.json(await getAudioDevices())
  }

  // GET /api/live-translation/settings
  if (
    req.method === 'GET' &&
    url.pathname === '/api/live-translation/settings'
  ) {
    return handleGetSettings()
  }

  // PUT /api/live-translation/settings
  if (
    req.method === 'PUT' &&
    url.pathname === '/api/live-translation/settings'
  ) {
    return handleSaveSettings(req)
  }

  return null
}

function handleStart(req: Request): Response {
  const startPromise = (async () => {
    try {
      const body = (await req.json()) as Partial<LiveTranslationConfig>

      if (!body.geminiApiKey) {
        return Response.json(
          { error: 'Gemini API key is required' },
          { status: 400 },
        )
      }

      const config: LiveTranslationConfig = {
        sourceLanguage: body.sourceLanguage || 'ro',
        targetLanguage: body.targetLanguage || 'en',
        voiceName: body.voiceName || 'Kore',
        geminiApiKey: body.geminiApiKey,
        inputDeviceId: body.inputDeviceId,
        outputDeviceId: body.outputDeviceId,
        muteWhileSpeaking: body.muteWhileSpeaking ?? false,
      }

      await startTranslation(config)

      logger.info('Translation started', {
        source: config.sourceLanguage,
        target: config.targetLanguage,
      })

      return Response.json({ success: true })
    } catch (error) {
      logger.error('Failed to start translation', { error: String(error) })
      return Response.json({ error: String(error) }, { status: 500 })
    }
  })()

  // Return the promise - Bun handles async responses
  return startPromise as unknown as Response
}

function handleStop(): Response {
  const stopPromise = (async () => {
    try {
      await stopTranslation()
      logger.info('Translation stopped')
      return Response.json({ success: true })
    } catch (error) {
      logger.error('Failed to stop translation', { error: String(error) })
      return Response.json({ error: String(error) }, { status: 500 })
    }
  })()

  return stopPromise as unknown as Response
}

const SETTINGS_KEY = 'live_translation_settings'

function handleGetSettings(): Response {
  const setting = getSetting('app_settings', SETTINGS_KEY)
  if (!setting) {
    return Response.json({
      sourceLanguage: 'ro',
      targetLanguage: 'en',
      voiceName: 'Kore',
      muteWhileSpeaking: false,
      inputDeviceId: null,
      outputDeviceId: null,
    })
  }
  return Response.json(JSON.parse(setting.value))
}

function handleSaveSettings(req: Request): Response {
  const savePromise = (async () => {
    try {
      const body = await req.json()
      // Never persist the API key — it stays client-side only
      const { geminiApiKey: _, ...settings } = body as Record<string, unknown>
      upsertSetting('app_settings', {
        key: SETTINGS_KEY,
        value: JSON.stringify(settings),
      })
      return Response.json({ success: true })
    } catch (error) {
      logger.error('Failed to save settings', { error: String(error) })
      return Response.json({ error: String(error) }, { status: 500 })
    }
  })()

  return savePromise as unknown as Response
}
