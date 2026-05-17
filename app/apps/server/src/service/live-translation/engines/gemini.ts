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

const SILENCE_THRESHOLD = 0.015
const SILENCE_GAP_MS = 1500
const MAX_SPEECH_DURATION_MS = 15000
const MAX_PENDING_CHARS = 150

function audioLevel(pcm: Buffer): number {
  if (pcm.length < 2) return 0
  let sum = 0
  const samples = Math.floor(pcm.length / 2)
  for (let i = 0; i < pcm.length - 1; i += 2) {
    const s = pcm.readInt16LE(i)
    sum += (s / 32768) ** 2
  }
  const rms = Math.sqrt(sum / samples)
  if (rms < 1e-6) return 0
  const dbfs = 20 * Math.log10(rms)
  return Math.max(0, Math.min(1, (dbfs + 60) / 60))
}

class GeminiEngineSession implements EngineSession {
  readonly targetId: string
  private session: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null =
    null
  private speaking = false
  private activityStarted = false
  private pendingChars = 0
  private buffered: Buffer[] = []
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private maxSpeechTimer: ReturnType<typeof setTimeout> | null = null
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

    this.session = await ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: systemPrompt,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: this.cfg.voiceName },
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        realtimeInputConfig: {
          automaticActivityDetection: { disabled: true },
        },
      },
      callbacks: {
        onopen: () => {
          logger.info('Connected to Gemini Live API', {
            targetId: this.targetId,
            target: this.cfg.targetLanguage,
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

    if (this.speaking) {
      this.buffered.push(pcm16khz)
      return
    }

    if (!this.activityStarted) {
      try {
        this.session.sendRealtimeInput({ activityStart: {} })
        this.activityStarted = true
      } catch (err) {
        logger.error('activityStart failed', { error: String(err) })
      }

      if (this.maxSpeechTimer) clearTimeout(this.maxSpeechTimer)
      this.maxSpeechTimer = setTimeout(() => {
        this.maxSpeechTimer = null
        if (this.activityStarted && !this.speaking) {
          this.forceEnd()
        }
      }, MAX_SPEECH_DURATION_MS)
    }

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

    const level = audioLevel(pcm16khz)
    if (level > SILENCE_THRESHOLD) {
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer)
        this.silenceTimer = null
      }
    } else if (!this.silenceTimer) {
      this.silenceTimer = setTimeout(() => {
        this.silenceTimer = null
        if (this.activityStarted && !this.speaking) {
          this.forceEnd()
        }
      }, SILENCE_GAP_MS)
    }
  }

  private forceEnd(): void {
    if (!this.session) return
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
    if (this.maxSpeechTimer) {
      clearTimeout(this.maxSpeechTimer)
      this.maxSpeechTimer = null
    }
    try {
      if (!this.activityStarted) {
        this.session.sendRealtimeInput({ activityStart: {} })
      }
      this.session.sendRealtimeInput({ activityEnd: {} })
      this.activityStarted = false
      this.pendingChars = 0
    } catch (err) {
      logger.error('forceEnd failed', { error: String(err) })
    }
  }

  private flushBuffered(): void {
    if (!this.session || this.buffered.length === 0) return
    const chunks = this.buffered.splice(0)
    try {
      this.session.sendRealtimeInput({ activityStart: {} })
      for (const chunk of chunks) {
        this.session.sendRealtimeInput({
          audio: {
            data: chunk.toString('base64'),
            mimeType: 'audio/pcm;rate=16000',
          },
        })
      }
      this.session.sendRealtimeInput({ activityEnd: {} })
      this.activityStarted = false
    } catch (err) {
      logger.error('flushBuffered failed', { error: String(err) })
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
      const text = content.inputTranscription.text.trim()
      if (text) {
        this.handlers.onSourceText(text)
        this.pendingChars += text.length
        if (this.pendingChars >= MAX_PENDING_CHARS && !this.speaking) {
          this.forceEnd()
        }
      }
    }

    if (content.outputTranscription?.text) {
      const text = content.outputTranscription.text.trim()
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
      }
    }

    if (content.turnComplete || content.interrupted) {
      this.speaking = false
      this.pendingChars = 0
      this.handlers.onTurnComplete()
      this.flushBuffered()
    }
  }

  async close(): Promise<void> {
    this.closed = true
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
    if (this.maxSpeechTimer) {
      clearTimeout(this.maxSpeechTimer)
      this.maxSpeechTimer = null
    }
    this.speaking = false
    this.activityStarted = false
    this.buffered.length = 0
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
