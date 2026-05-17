import { log } from '../../../utils/fileLogger'
import { buildSystemPrompt } from '../types'
import type { EngineHandlers, EngineSession, EngineSessionConfig } from './types'

const logger = {
  debug: (msg: string, data?: unknown) =>
    log('live-translation:openai', 'debug', msg, data),
  info: (msg: string, data?: unknown) =>
    log('live-translation:openai', 'info', msg, data),
  warn: (msg: string, data?: unknown) =>
    log('live-translation:openai', 'warn', msg, data),
  error: (msg: string, data?: unknown) =>
    log('live-translation:openai', 'error', msg, data),
}

// OpenAI Realtime API went GA on May 12 2026; the legacy
// `gpt-4o-realtime-preview` + `OpenAI-Beta: realtime=v1` combo is deprecated.
const OPENAI_REALTIME_URL =
  'wss://api.openai.com/v1/realtime?model=gpt-realtime'
const INPUT_SAMPLE_RATE = 16000
const TARGET_SAMPLE_RATE = 24000

/** Upsample 16kHz PCM16 → 24kHz PCM16 (linear interpolation, mono). */
function upsample16to24(pcm16khz: Buffer): Buffer {
  const inSamples = Math.floor(pcm16khz.length / 2)
  if (inSamples === 0) return Buffer.alloc(0)
  const outSamples = Math.ceil((inSamples * TARGET_SAMPLE_RATE) / INPUT_SAMPLE_RATE)
  const out = Buffer.alloc(outSamples * 2)
  const ratio = INPUT_SAMPLE_RATE / TARGET_SAMPLE_RATE
  for (let i = 0; i < outSamples; i++) {
    const srcIdx = i * ratio
    const srcLow = Math.floor(srcIdx)
    const srcHigh = Math.min(srcLow + 1, inSamples - 1)
    const frac = srcIdx - srcLow
    const a = pcm16khz.readInt16LE(srcLow * 2)
    const b = pcm16khz.readInt16LE(srcHigh * 2)
    const v = Math.round(a + (b - a) * frac)
    out.writeInt16LE(Math.max(-32768, Math.min(32767, v)), i * 2)
  }
  return out
}

class OpenAIEngineSession implements EngineSession {
  readonly targetId: string
  private ws: WebSocket | null = null
  private speaking = false
  private closed = false
  private opened = false
  private pendingFrames: string[] = []

  constructor(
    private readonly cfg: EngineSessionConfig,
    private readonly handlers: EngineHandlers,
  ) {
    this.targetId = cfg.targetId
  }

  async start(): Promise<void> {
    const headers = { Authorization: `Bearer ${this.cfg.apiKey}` }
    this.ws = new WebSocket(OPENAI_REALTIME_URL, {
      headers,
    } as unknown as string[])

    await new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject(new Error('ws not initialized'))
      const onOpen = () => {
        this.opened = true
        logger.info('Connected to OpenAI Realtime API', {
          targetId: this.targetId,
          target: this.cfg.targetLanguage,
        })
        this.sendSessionUpdate()
        for (const frame of this.pendingFrames) this.sendRaw(frame)
        this.pendingFrames.length = 0
        resolve()
      }
      const onError = (ev: Event) => {
        const err = (ev as ErrorEvent).message || 'WebSocket error'
        logger.error('OpenAI ws error', { error: err })
        reject(new Error(err))
      }
      this.ws.addEventListener('open', onOpen, { once: true })
      this.ws.addEventListener('error', onError, { once: true })
    })

    this.ws.addEventListener('message', (ev) => this.handleMessage(ev.data))
    this.ws.addEventListener('error', (ev) => {
      const err = (ev as ErrorEvent).message || 'WebSocket error'
      this.handlers.onError(err)
    })
    this.ws.addEventListener('close', () => {
      logger.info('OpenAI ws closed', { targetId: this.targetId })
      this.handlers.onClose()
    })
  }

  isSpeaking(): boolean {
    return this.speaking
  }

  sendAudio(pcm16khz: Buffer): void {
    if (this.closed) return
    const pcm24 = upsample16to24(pcm16khz)
    const payload = JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: pcm24.toString('base64'),
    })
    if (!this.opened || !this.ws || this.ws.readyState !== 1) {
      this.pendingFrames.push(payload)
      return
    }
    this.sendRaw(payload)
  }

  private sendRaw(payload: string): void {
    try {
      this.ws?.send(payload)
    } catch (err) {
      logger.error('send failed', { error: String(err) })
    }
  }

  private sendSessionUpdate(): void {
    const systemPrompt = buildSystemPrompt(
      this.cfg.sourceLanguage,
      this.cfg.targetLanguage,
    )
    const textOnly = this.cfg.outputModality === 'text_only'
    // GA session schema (OpenAI Realtime, May 2026) — audio is nested under
    // session.audio.{input,output}; modalities renamed to output_modalities.
    this.sendRaw(
      JSON.stringify({
        type: 'session.update',
        session: {
          type: 'realtime',
          model: 'gpt-realtime',
          instructions: systemPrompt,
          output_modalities: textOnly ? ['text'] : ['audio'],
          audio: {
            input: {
              format: { type: 'audio/pcm', rate: TARGET_SAMPLE_RATE },
              transcription: { model: 'gpt-realtime-whisper' },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 700,
              },
            },
            ...(textOnly
              ? {}
              : {
                  output: {
                    format: { type: 'audio/pcm' },
                    voice: this.cfg.voiceName,
                  },
                }),
          },
        },
      }),
    )
  }

  private handleMessage(raw: unknown): void {
    let msg: { type?: string; [k: string]: unknown }
    try {
      msg =
        typeof raw === 'string'
          ? JSON.parse(raw)
          : JSON.parse(Buffer.from(raw as ArrayBuffer).toString('utf-8'))
    } catch {
      return
    }

    switch (msg.type) {
      case 'input_audio_buffer.speech_started':
        // user started speaking
        break
      case 'input_audio_buffer.speech_stopped':
        // user stopped — server VAD will commit
        break
      case 'conversation.item.input_audio_transcription.delta':
      case 'conversation.item.input_audio_transcription.completed': {
        // GA emits both .delta and .completed; merge logic in caller dedupes
        const text = (
          (msg.transcript as string | undefined) ||
          (msg.delta as string | undefined)
        )?.trim()
        if (text) this.handlers.onSourceText(text)
        break
      }
      case 'response.output_audio.delta': {
        const b64 = msg.delta as string | undefined
        if (b64) {
          const pcm = Buffer.from(b64, 'base64')
          if (!this.speaking) {
            this.speaking = true
            this.handlers.onSpeakingStart()
          }
          this.handlers.onAudioOutput(pcm)
        }
        break
      }
      case 'response.output_audio_transcript.delta':
      case 'response.output_text.delta': {
        const delta = (msg.delta as string | undefined)?.trim()
        if (delta) this.handlers.onTargetText(delta)
        break
      }
      case 'response.output_audio.done':
      case 'response.done':
        this.speaking = false
        this.handlers.onTurnComplete()
        break
      case 'error': {
        const err = msg.error as { message?: string } | undefined
        const errMsg = err?.message || 'OpenAI Realtime error'
        logger.error('OpenAI error event', { error: errMsg, raw: msg })
        this.handlers.onError(errMsg)
        break
      }
      default:
        // ignore other event types
        break
    }
  }

  async close(): Promise<void> {
    this.closed = true
    this.speaking = false
    try {
      this.ws?.close()
    } catch (err) {
      logger.error('close failed', { error: String(err) })
    }
    this.ws = null
  }
}

export async function createOpenAISession(
  config: EngineSessionConfig,
  handlers: EngineHandlers,
): Promise<EngineSession> {
  const session = new OpenAIEngineSession(config, handlers)
  await session.start()
  return session
}
