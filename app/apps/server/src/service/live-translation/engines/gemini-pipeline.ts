import { GoogleGenAI } from '@google/genai'

import { log } from '../../../utils/fileLogger'
import { LANGUAGE_NAMES } from '../types'
import type { EngineHandlers, EngineSession, EngineSessionConfig } from './types'

const logger = {
  debug: (msg: string, data?: unknown) =>
    log('live-translation:gemini-pipeline', 'debug', msg, data),
  info: (msg: string, data?: unknown) =>
    log('live-translation:gemini-pipeline', 'info', msg, data),
  warn: (msg: string, data?: unknown) =>
    log('live-translation:gemini-pipeline', 'warn', msg, data),
  error: (msg: string, data?: unknown) =>
    log('live-translation:gemini-pipeline', 'error', msg, data),
}

// Text-only pipeline: cheap models, no live bidi.
//   Stage 1 — Flash Lite transcribes the captured audio chunk
//   Stage 2 — Flash translates the transcript and streams the result
// Falls back through several model id variants per stage so we don't break
// if Google renames or deprecates one.
const TRANSCRIBE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
] as const
const TRANSLATE_MODELS = [
  'gemini-3.1-flash',
  'gemini-2.5-flash',
] as const

const SAMPLE_RATE = 16000
const SILENCE_THRESHOLD = 0.015
const SILENCE_GAP_MS = 900
const MAX_UTTERANCE_MS = 12_000
const MIN_UTTERANCE_MS = 400

/** RMS audio level on 16-bit PCM, normalized 0..1 (log scale). */
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

/** Wrap raw PCM16 mono in a minimal WAV container so generateContent
 *  accepts it as `audio/wav` (it doesn't accept bare `audio/pcm`). */
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = pcm.length
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16) // fmt chunk size
  header.writeUInt16LE(1, 20) // audio format = PCM
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)
  return Buffer.concat([header, pcm])
}

class GeminiPipelineSession implements EngineSession {
  readonly targetId: string
  private ai: GoogleGenAI
  private buffer: Buffer[] = []
  private bufferBytes = 0
  private hasSpeech = false
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private maxTimer: ReturnType<typeof setTimeout> | null = null
  private utteranceStartAt = 0
  private speaking = false
  private closed = false
  private processing = false
  private queue: Promise<void> = Promise.resolve()
  private transcribeModel: string
  private translateModel: string

  constructor(
    private readonly cfg: EngineSessionConfig,
    private readonly handlers: EngineHandlers,
  ) {
    this.targetId = cfg.targetId
    this.ai = new GoogleGenAI({ apiKey: cfg.apiKey })
    this.transcribeModel = TRANSCRIBE_MODELS[0]
    this.translateModel = TRANSLATE_MODELS[0]
  }

  start(): Promise<void> {
    logger.info('Pipeline session started', {
      targetId: this.targetId,
      source: this.cfg.sourceLanguage,
      target: this.cfg.targetLanguage,
      transcribeModel: this.transcribeModel,
      translateModel: this.translateModel,
    })
    return Promise.resolve()
  }

  isSpeaking(): boolean {
    return this.speaking
  }

  sendAudio(pcm: Buffer): void {
    if (this.closed) return

    if (this.buffer.length === 0) this.utteranceStartAt = Date.now()
    this.buffer.push(pcm)
    this.bufferBytes += pcm.length

    const level = audioLevel(pcm)
    const isSpeech = level > SILENCE_THRESHOLD

    if (isSpeech) {
      this.hasSpeech = true
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer)
        this.silenceTimer = null
      }
      if (!this.maxTimer) {
        this.maxTimer = setTimeout(() => {
          this.maxTimer = null
          this.flushUtterance('max-duration')
        }, MAX_UTTERANCE_MS)
      }
    } else if (this.hasSpeech && !this.silenceTimer) {
      this.silenceTimer = setTimeout(() => {
        this.silenceTimer = null
        this.flushUtterance('silence')
      }, SILENCE_GAP_MS)
    }
  }

  private flushUtterance(reason: 'silence' | 'max-duration'): void {
    if (this.closed || !this.hasSpeech) return
    if (Date.now() - this.utteranceStartAt < MIN_UTTERANCE_MS) return

    const chunks = this.buffer.splice(0)
    this.bufferBytes = 0
    this.hasSpeech = false
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
    if (this.maxTimer) {
      clearTimeout(this.maxTimer)
      this.maxTimer = null
    }
    if (chunks.length === 0) return

    const pcm = Buffer.concat(chunks)
    const ms = (pcm.length / 2) * (1000 / SAMPLE_RATE)
    logger.debug('Flushing utterance', {
      targetId: this.targetId,
      reason,
      ms: Math.round(ms),
    })

    // Serialize transcribe→translate calls so one slow utterance doesn't
    // overlap with the next one.
    this.queue = this.queue.then(() => this.processUtterance(pcm))
  }

  private async processUtterance(pcm: Buffer): Promise<void> {
    if (this.closed) return
    this.processing = true
    try {
      const wav = pcmToWav(pcm, SAMPLE_RATE)
      const sourceName =
        LANGUAGE_NAMES[this.cfg.sourceLanguage] || this.cfg.sourceLanguage
      const targetName =
        LANGUAGE_NAMES[this.cfg.targetLanguage] || this.cfg.targetLanguage

      // ------- Stage 1: transcribe -------
      const sourceText = await this.transcribe(wav, sourceName)
      if (!sourceText) {
        logger.debug('Empty transcript, skipping translation', {
          targetId: this.targetId,
        })
        return
      }
      this.handlers.onSourceText(sourceText)

      // ------- Stage 2: translate (streaming) -------
      this.speaking = true
      this.handlers.onSpeakingStart()
      await this.translate(sourceText, sourceName, targetName)
      this.handlers.onTurnComplete()
    } catch (err) {
      logger.error('Utterance pipeline failed', {
        targetId: this.targetId,
        error: String(err),
      })
      this.handlers.onError(String(err))
    } finally {
      this.speaking = false
      this.processing = false
    }
  }

  private async transcribe(wav: Buffer, sourceName: string): Promise<string> {
    const prompt = `Transcribe this ${sourceName} audio verbatim. Output ONLY the transcript — no preface, no quotes, no metadata. If the audio is silence or has no clear speech, output an empty string.`
    let lastErr: unknown
    for (const model of TRANSCRIBE_MODELS) {
      try {
        const resp = await this.ai.models.generateContent({
          model,
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/wav',
                    data: wav.toString('base64'),
                  },
                },
                { text: prompt },
              ],
            },
          ],
        })
        this.transcribeModel = model
        return (resp.text || '').trim()
      } catch (err) {
        lastErr = err
        logger.warn('Transcribe model rejected, trying next', {
          model,
          error: String(err),
        })
      }
    }
    throw lastErr
  }

  private async translate(
    sourceText: string,
    sourceName: string,
    targetName: string,
  ): Promise<void> {
    const prompt = `Translate the following ${sourceName} text into ${targetName}. Output ONLY the translation, nothing else — no preface, no quotes, no metadata, no source repeat. Translate word-for-word, preserving names, numbers, dates, and sentence structure.\n\n${sourceText}`
    let lastErr: unknown
    for (const model of TRANSLATE_MODELS) {
      try {
        const stream = await this.ai.models.generateContentStream({
          model,
          contents: [{ parts: [{ text: prompt }] }],
        })
        this.translateModel = model
        for await (const chunk of stream) {
          if (this.closed) return
          const piece = chunk.text
          if (piece) this.handlers.onTargetText(piece)
        }
        return
      } catch (err) {
        lastErr = err
        logger.warn('Translate model rejected, trying next', {
          model,
          error: String(err),
        })
      }
    }
    throw lastErr
  }

  async close(): Promise<void> {
    this.closed = true
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
    if (this.maxTimer) {
      clearTimeout(this.maxTimer)
      this.maxTimer = null
    }
    this.buffer.length = 0
    this.bufferBytes = 0
    this.hasSpeech = false
    this.handlers.onClose()
  }
}

export async function createGeminiPipelineSession(
  config: EngineSessionConfig,
  handlers: EngineHandlers,
): Promise<EngineSession> {
  const s = new GeminiPipelineSession(config, handlers)
  await s.start()
  return s
}
