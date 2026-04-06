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
import {
  broadcastAudioToListeners,
  getListenerCount,
  getStreamSecret,
  resetStreamSecret,
  startSignalingRelay,
  stopSignalingRelay,
} from '../service/live-translation/stream'
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
  // Also broadcast to WebRTC/stream listeners
  broadcastAudioToListeners(pcmData)
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
    try {
      return Response.json(await getAudioDevices())
    } catch (error) {
      logger.error('Failed to get audio devices', { error: String(error) })
      // Audio library not available on this platform — return empty device list
      return Response.json({
        devices: [],
        defaultInputId: -1,
        defaultOutputId: -1,
      })
    }
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

  // GET /api/live-translation/stream-secret
  if (
    req.method === 'GET' &&
    url.pathname === '/api/live-translation/stream-secret'
  ) {
    return Response.json({ secret: getStreamSecret() })
  }

  // POST /api/live-translation/stream-secret/reset
  if (
    req.method === 'POST' &&
    url.pathname === '/api/live-translation/stream-secret/reset'
  ) {
    return Response.json({ secret: resetStreamSecret() })
  }

  // GET /api/live-translation/stream-info
  if (
    req.method === 'GET' &&
    url.pathname === '/api/live-translation/stream-info'
  ) {
    return Response.json({ listeners: getListenerCount() })
  }

  return null
}

function handleStart(req: Request): Response {
  const startPromise = (async () => {
    try {
      const body = (await req.json()) as Partial<LiveTranslationConfig>

      // Use provided key or fall back to saved settings
      if (!body.geminiApiKey) {
        const saved = getSetting('app_settings', SETTINGS_KEY)
        if (saved) {
          const parsed = JSON.parse(saved.value)
          body.geminiApiKey = parsed.geminiApiKey
        }
      }

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
        outputMode: body.outputMode ?? 'device',
      }

      await startTranslation(config)

      // Start signaling relay if WebRTC output is enabled
      const useWebrtc =
        config.outputMode === 'webrtc' || config.outputMode === 'both'
      if (useWebrtc) {
        await startSignalingRelay()
      }

      logger.info('Translation started', {
        source: config.sourceLanguage,
        target: config.targetLanguage,
        outputMode: config.outputMode,
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
      await stopSignalingRelay()
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
      // Persist all settings including API key (encrypted at rest in DB)
      upsertSetting('app_settings', {
        key: SETTINGS_KEY,
        value: JSON.stringify(body),
      })
      return Response.json({ success: true })
    } catch (error) {
      logger.error('Failed to save settings', { error: String(error) })
      return Response.json({ error: String(error) }, { status: 500 })
    }
  })()

  return savePromise as unknown as Response
}
