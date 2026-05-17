import { GoogleGenAI, Modality } from '@google/genai'

import { log } from '../../../utils/fileLogger'
import { buildSystemPrompt } from '../types'
import type { EngineHandlers, EngineSession, EngineSessionConfig } from './types'

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

// Current (May 2026) GA / live model ids.
// `gemini-2.5-flash-native-audio-preview-12-2025` was sunset 2026-03-19.
const AUDIO_MODEL = 'gemini-live-2.5-flash-native-audio'
const TEXT_MODEL = 'gemini-live-2.5-flash-preview'

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
    // Native-audio models only support AUDIO response modality. Text mode
    // runs on the non-native preview which supports TEXT response.
    const model = textOnly ? TEXT_MODEL : AUDIO_MODEL

    // Use the server's built-in VAD — far more reliable than manually
    // signaling activityStart/activityEnd, which silently produces no
    // output if forceEnd is never triggered.
    this.session = await ai.live.connect({
      model,
      config: {
        responseModalities: textOnly ? [Modality.TEXT] : [Modality.AUDIO],
        systemInstruction: systemPrompt,
        ...(textOnly
          ? {}
          : {
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: this.cfg.voiceName },
                },
              },
              outputAudioTranscription: {},
            }),
        inputAudioTranscription: {},
      },
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
          logger.error('Gemini error', {
            targetId: this.targetId,
            error: String(err),
          })
          this.handlers.onError(String(err))
        },
        onclose: () => {
          logger.info('Gemini session closed', { targetId: this.targetId })
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
      for (const part of content.modelTurn.parts) {
        if (part.inlineData?.data) {
          const pcm = Buffer.from(part.inlineData.data, 'base64')
          if (!this.speaking) {
            this.speaking = true
            this.handlers.onSpeakingStart()
          }
          this.handlers.onAudioOutput(pcm)
        }
        if (part.text) {
          // Text-only model: returns plain text parts (no transcription event)
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
