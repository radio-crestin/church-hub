import { GoogleGenAI, Modality } from '@google/genai'

import type {
  EngineHandlers,
  EngineSession,
  EngineSessionConfig,
} from './types'
import { log } from '../../../utils/fileLogger'
import { buildSystemPrompt } from '../types'

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

// Verified against the user's Gemini API model list (May 2026).
// The text-out preview (`gemini-3.1-flash-live-preview`) keeps responding
// with 1011 "Internal error" on bidi connect, so text-only sessions run
// on the same native-audio model and we just read the output transcript
// while throwing away the synthesized audio bytes. Costs the same as
// audio mode for now but is reliable.
const AUDIO_MODEL = 'gemini-2.5-flash-native-audio-latest'

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
    const systemPrompt = buildSystemPrompt(
      this.cfg.sourceLanguage,
      this.cfg.targetLanguage,
    )

    const textOnly = this.cfg.outputModality === 'text_only'
    // Single model for both modes (see comment by AUDIO_MODEL). Text-only
    // discards the audio output and surfaces only the running transcript.
    const model = AUDIO_MODEL

    // Use the server's built-in VAD — far more reliable than manually
    // signaling activityStart/activityEnd, which silently produces no
    // output if forceEnd is never triggered.
    // Both modes run on the native-audio model with AUDIO response so we
    // always get an output transcript. In text-only mode the engine drops
    // the audio bytes (no onAudioOutput call) — the listener / host UI
    // just sees text.
    const config = {
      responseModalities: [Modality.AUDIO],
      systemInstruction: systemPrompt,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: this.cfg.voiceName },
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    }

    this.session = await ai.live.connect({
      model,
      config,
      callbacks: {
        onopen: () => {
          logger.info('Connected to Gemini Live API', {
            targetId: this.targetId,
            target: this.cfg.targetLanguage,
            model,
            modality: this.cfg.outputModality,
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
      const suppressAudio = this.cfg.outputModality === 'text_only'
      for (const part of content.modelTurn.parts) {
        if (part.inlineData?.data && !suppressAudio) {
          const pcm = Buffer.from(part.inlineData.data, 'base64')
          if (!this.speaking) {
            this.speaking = true
            this.handlers.onSpeakingStart()
          }
          this.handlers.onAudioOutput(pcm)
        }
        if (part.text) {
          this.handlers.onTargetText(part.text)
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
