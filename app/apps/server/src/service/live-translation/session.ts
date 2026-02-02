import { GoogleGenAI, Modality } from '@google/genai'

import {
  muteAudioCapture,
  playAudioChunk,
  startAudioCapture,
  startAudioPlayback,
  stopAudioCapture,
  stopAudioPlayback,
  unmuteAudioCapture,
} from './audio-io'
import type {
  LiveTranslationConfig,
  LiveTranslationState,
  TranscriptionEntry,
} from './types'
import { DEFAULT_TRANSLATION_STATE } from './types'
import { log } from '../../utils/fileLogger'

const logger = {
  debug: (msg: string, data?: unknown) =>
    log('live-translation', 'debug', msg, data),
  info: (msg: string, data?: unknown) =>
    log('live-translation', 'info', msg, data),
  warn: (msg: string, data?: unknown) =>
    log('live-translation', 'warn', msg, data),
  error: (msg: string, data?: unknown) =>
    log('live-translation', 'error', msg, data),
}

type StateCallback = (state: LiveTranslationState) => void
type AudioOutputCallback = (pcmData: Buffer) => void
type TranscriptionCallback = (
  entry: TranscriptionEntry,
  action: 'add' | 'update',
) => void
type AudioLevelCallback = (level: number, type: 'input' | 'output') => void

let currentSession: ReturnType<
  Awaited<ReturnType<GoogleGenAI['live']['connect']>>
> | null = null
let currentState: LiveTranslationState = { ...DEFAULT_TRANSLATION_STATE }
let stateCallback: StateCallback | null = null
let audioOutputCallback: AudioOutputCallback | null = null
let transcriptionCallback: TranscriptionCallback | null = null
let audioLevelCallback: AudioLevelCallback | null = null
let transcriptionIdCounter = 0
let muteWhileSpeaking = false
let isSpeaking = false

export function setStateCallback(cb: StateCallback) {
  stateCallback = cb
}

export function setAudioOutputCallback(cb: AudioOutputCallback) {
  audioOutputCallback = cb
}

export function setTranscriptionCallback(cb: TranscriptionCallback) {
  transcriptionCallback = cb
}

export function setAudioLevelCallback(cb: AudioLevelCallback) {
  audioLevelCallback = cb
}

export function getTranslationState(): LiveTranslationState {
  return { ...currentState }
}

function updateState(partial: Partial<LiveTranslationState>) {
  currentState = { ...currentState, ...partial }
  stateCallback?.(currentState)
}

function generateId(): string {
  return `t-${Date.now()}-${++transcriptionIdCounter}`
}

/**
 * Calculate perceptual audio level from 16-bit PCM buffer.
 * Uses RMS with gain boost and a logarithmic scale for natural meter behavior.
 * Returns a value between 0 and 1.
 */
export function calculateAudioLevel(pcmBuffer: Buffer): number {
  if (pcmBuffer.length < 2) return 0

  let sumSquares = 0
  const sampleCount = Math.floor(pcmBuffer.length / 2)

  for (let i = 0; i < pcmBuffer.length - 1; i += 2) {
    const sample = pcmBuffer.readInt16LE(i)
    sumSquares += (sample / 32768) ** 2
  }

  const rms = Math.sqrt(sumSquares / sampleCount)

  // Convert to dBFS (0 dBFS = full scale, silence ~ -96 dBFS for 16-bit)
  if (rms < 0.000001) return 0
  const dbfs = 20 * Math.log10(rms)

  // Map -60 dBFS..0 dBFS to 0..1 (speech typically sits around -30 to -10 dBFS)
  const minDb = -60
  const normalized = Math.max(0, Math.min(1, (dbfs - minDb) / -minDb))

  return normalized
}

export async function startTranslation(
  config: LiveTranslationConfig,
): Promise<void> {
  if (currentSession) {
    logger.warn('Translation session already active, stopping first')
    await stopTranslation()
  }

  logger.info('Starting live translation session', {
    source: config.sourceLanguage,
    target: config.targetLanguage,
    voice: config.voiceName,
  })

  muteWhileSpeaking = config.muteWhileSpeaking ?? false
  isSpeaking = false

  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey })

  const systemPrompt = buildSystemPrompt(
    config.sourceLanguage,
    config.targetLanguage,
  )

  const session = await ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: systemPrompt,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: config.voiceName },
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
    callbacks: {
      async onopen() {
        logger.info('Connected to Gemini Live API')
        updateState({
          isActive: true,
          sourceLanguage: config.sourceLanguage,
          targetLanguage: config.targetLanguage,
          startedAt: Date.now(),
          error: undefined,
        })

        // Start audio capture only after Gemini is connected
        // so no chunks are lost before the session is ready
        await startAudioCapture((pcmBuffer) => {
          sendAudioChunk(pcmBuffer)
        }, config.inputDeviceId)
      },
      onmessage(message: unknown) {
        handleGeminiMessage(message)
      },
      onerror(error: unknown) {
        logger.error('Gemini Live API error', { error: String(error) })
        updateState({ error: String(error) })
      },
      onclose() {
        logger.info('Gemini Live API session closed')
        updateState({
          isActive: false,
          inputAudioLevel: 0,
          outputAudioLevel: 0,
          startedAt: null,
        })
        currentSession = null
      },
    },
  })

  currentSession = session as typeof currentSession

  // Start server-side audio playback process (capture starts in onopen callback)
  await startAudioPlayback(config.outputDeviceId)
}

/**
 * Append text to the last transcription entry if it's the same type,
 * otherwise create a new entry.
 */
function appendOrCreateEntry(
  text: string,
  type: 'source' | 'translation',
): void {
  const last = currentState.transcription[currentState.transcription.length - 1]

  if (last && last.type === type) {
    // Merge into existing bubble – concatenate directly since Gemini
    // sends incremental chunks that already include proper spacing.
    last.text += text
    last.timestamp = Date.now()
    transcriptionCallback?.(last, 'update')
  } else {
    // New bubble
    const entry: TranscriptionEntry = {
      id: generateId(),
      text,
      type,
      timestamp: Date.now(),
    }
    currentState.transcription.push(entry)
    if (currentState.transcription.length > 100) {
      currentState.transcription = currentState.transcription.slice(-100)
    }
    transcriptionCallback?.(entry, 'add')
  }

  updateState({ transcription: currentState.transcription })
}

function handleGeminiMessage(message: unknown) {
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
    }
  }

  if (!msg.serverContent) return

  // Handle input transcription (what the speaker said)
  if (msg.serverContent.inputTranscription?.text) {
    const text = msg.serverContent.inputTranscription.text.trim()
    if (text) {
      appendOrCreateEntry(text, 'source')
    }
  }

  // Handle output transcription (what Gemini translated)
  if (msg.serverContent.outputTranscription?.text) {
    const text = msg.serverContent.outputTranscription.text.trim()
    if (text) {
      appendOrCreateEntry(text, 'translation')
    }
  }

  // Handle audio output
  if (msg.serverContent.modelTurn?.parts) {
    if (muteWhileSpeaking && !isSpeaking) {
      isSpeaking = true
      muteAudioCapture()
      logger.debug('Muted mic while AI is speaking')
    }

    for (const part of msg.serverContent.modelTurn.parts) {
      if (part.inlineData?.data) {
        const pcmBuffer = Buffer.from(part.inlineData.data, 'base64')
        const level = calculateAudioLevel(pcmBuffer)
        audioLevelCallback?.(level, 'output')
        updateState({ outputAudioLevel: level })
        audioOutputCallback?.(pcmBuffer)
        // Play audio through server speakers
        playAudioChunk(pcmBuffer)
      }
    }
  }

  // When there's no modelTurn (turn ended), unmute mic
  if (isSpeaking && !msg.serverContent.modelTurn) {
    isSpeaking = false
    if (muteWhileSpeaking) {
      unmuteAudioCapture()
      logger.debug('Unmuted mic after AI finished speaking')
    }
  }
}

export function sendAudioChunk(pcmBuffer: Buffer): void {
  if (!currentSession) return

  const level = calculateAudioLevel(pcmBuffer)
  audioLevelCallback?.(level, 'input')
  updateState({ inputAudioLevel: level })

  try {
    currentSession.sendRealtimeInput({
      audio: {
        data: pcmBuffer.toString('base64'),
        mimeType: 'audio/pcm;rate=16000',
      },
    })
  } catch (error) {
    logger.error('Failed to send audio chunk', { error: String(error) })
  }
}

export async function stopTranslation(): Promise<void> {
  if (!currentSession) return

  logger.info('Stopping live translation session')

  // Stop server-side audio I/O
  stopAudioCapture()
  stopAudioPlayback()

  try {
    currentSession.close()
  } catch (error) {
    logger.error('Error closing session', { error: String(error) })
  }

  currentSession = null
  isSpeaking = false
  currentState = { ...DEFAULT_TRANSLATION_STATE }
  stateCallback?.(currentState)
}

export function clearTranscription(): void {
  currentState.transcription = []
  updateState({ transcription: [] })
}

export function isTranslationActive(): boolean {
  return currentSession !== null && currentState.isActive
}

function buildSystemPrompt(
  sourceLanguage: string,
  targetLanguage: string,
): string {
  const langNames: Record<string, string> = {
    ro: 'Romanian',
    en: 'English',
    de: 'German',
    fr: 'French',
    es: 'Spanish',
    it: 'Italian',
    hu: 'Hungarian',
    pt: 'Portuguese',
    ru: 'Russian',
    uk: 'Ukrainian',
    pl: 'Polish',
    nl: 'Dutch',
    ar: 'Arabic',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
  }

  const sourceName = langNames[sourceLanguage] || sourceLanguage
  const targetName = langNames[targetLanguage] || targetLanguage

  return (
    `You are a professional simultaneous interpreter. ` +
    `Listen to the user speaking in ${sourceName} and translate everything they say into ${targetName}. ` +
    `Speak the translation immediately and naturally. ` +
    `Preserve the tone, emotion, and pacing of the original speech. ` +
    `Do not add any commentary, explanations, or filler words. ` +
    `Just translate faithfully and immediately. ` +
    `If there is silence, remain silent. ` +
    `If the speaker pauses mid-sentence, wait for them to finish before translating.`
  )
}
