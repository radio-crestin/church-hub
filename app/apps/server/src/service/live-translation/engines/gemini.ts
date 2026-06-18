import { GoogleGenAI, Modality } from '@google/genai'

import type {
  EngineHandlers,
  EngineSession,
  EngineSessionConfig,
} from './types'
import { log } from '../../../utils/fileLogger'
import { toBcp47 } from '../types'

const logger = {
  debug: (msg: string, data?: unknown) =>
    log('live-translation:gemini', 'debug', msg, data),
  info: (msg: string, data?: unknown) =>
    log('live-translation:gemini', 'info', msg, data),
  warn: (msg: string, data?: unknown) =>
    log('live-translation:gemini', 'warn', msg, data),
  error: (msg: string, data?: unknown) =>
    log('live-translation:gemini', 'error', msg, data),
}

// Purpose-built speech-to-speech translation model. It translates the input
// audio natively (via translationConfig) and preserves the speaker's own
// voice — no system prompt and no voice selection are needed.
// https://ai.google.dev/gemini-api/docs/live-api/live-translate
const MODEL = 'gemini-3.5-live-translate-preview'

class GeminiEngineSession implements EngineSession {
  readonly targetId: string
  private session: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null =
    null
  private speaking = false
  private closed = false

  constructor(
    private readonly cfg: EngineSessionConfig,
    private readonly handlers: EngineHandlers,
  ) {
    this.targetId = cfg.targetId
  }

  async start(): Promise<void> {
    const ai = new GoogleGenAI({ apiKey: this.cfg.apiKey })
    const targetLanguageCode = toBcp47(this.cfg.targetLanguage)

    // The live-translate model requires an AUDIO response. We additionally
    // enable input/output transcription so the host UI and listeners get the
    // source + translated text alongside the synthesized audio.
    const config = {
      responseModalities: [Modality.AUDIO],
      translationConfig: {
        targetLanguageCode,
        // Don't re-emit audio that's already in the target language (e.g. the
        // app's own translated playback being picked up by the mic).
        echoTargetLanguage: false,
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    }

    this.session = await ai.live.connect({
      model: MODEL,
      config,
      callbacks: {
        onopen: () => {
          logger.info('Connected to Gemini Live Translate', {
            targetId: this.targetId,
            target: targetLanguageCode,
            model: MODEL,
          })
        },
        onmessage: (msg) => this.handleMessage(msg),
        onerror: (err) => {
          const e = err as ErrorEvent
          const detail = {
            message: e?.message,
            error: e?.error,
            type: e?.type,
            stringified: String(err),
          }
          logger.error('Gemini error', {
            targetId: this.targetId,
            ...detail,
          })
          this.handlers.onError(e?.message || String(err))
        },
        onclose: (ev) => {
          const e = ev as CloseEvent
          logger.info('Gemini session closed', {
            targetId: this.targetId,
            code: e?.code,
            reason: e?.reason,
            wasClean: e?.wasClean,
          })
          if (e?.code && e.code !== 1000) {
            // Surface non-clean closes (e.g. 1007 invalid frame, 1011 server
            // error, 4xx-mapped). Without this the host sees nothing.
            this.handlers.onError(
              `Gemini closed: ${e.code} ${e.reason || 'unknown'}`,
            )
          }
          this.handlers.onClose()
        },
      },
    })
  }

  isSpeaking(): boolean {
    return this.speaking
  }

  sendAudio(pcm16khz: Buffer): void {
    if (!this.session || this.closed) return
    try {
      this.session.sendRealtimeInput({
        audio: {
          data: pcm16khz.toString('base64'),
          mimeType: 'audio/pcm;rate=16000',
        },
      })
    } catch (err) {
      logger.error('audio send failed', { error: String(err) })
    }
  }

  private handleMessage(message: unknown): void {
    const msg = message as {
      serverContent?: {
        modelTurn?: {
          parts?: Array<{
            inlineData?: { data: string; mimeType?: string }
            text?: string
          }>
        }
        inputTranscription?: { text: string }
        outputTranscription?: { text: string }
        turnComplete?: boolean
        interrupted?: boolean
      }
    }

    const content = msg.serverContent
    if (!content) return

    if (content.inputTranscription?.text) {
      const text = content.inputTranscription.text
      if (text) this.handlers.onSourceText(text)
    }

    if (content.outputTranscription?.text) {
      const text = content.outputTranscription.text
      if (text) this.handlers.onTargetText(text)
    }

    if (content.modelTurn?.parts) {
      // responseModalities is AUDIO, so model turn parts carry the synthesized
      // audio. The translated *text* arrives via outputTranscription above —
      // do NOT also read part.text here or the line gets duplicated.
      for (const part of content.modelTurn.parts) {
        if (part.inlineData?.data) {
          const pcm = Buffer.from(part.inlineData.data, 'base64')
          if (!this.speaking) {
            this.speaking = true
            this.handlers.onSpeakingStart()
          }
          this.handlers.onAudioOutput(pcm)
        }
      }
    }

    if (content.turnComplete || content.interrupted) {
      this.speaking = false
      this.handlers.onTurnComplete()
    }
  }

  async close(): Promise<void> {
    this.closed = true
    this.speaking = false
    try {
      this.session?.close()
    } catch (err) {
      logger.error('close failed', { error: String(err) })
    }
    this.session = null
  }
}

export async function createGeminiSession(
  config: EngineSessionConfig,
  handlers: EngineHandlers,
): Promise<EngineSession> {
  const session = new GeminiEngineSession(config, handlers)
  await session.start()
  return session
}
