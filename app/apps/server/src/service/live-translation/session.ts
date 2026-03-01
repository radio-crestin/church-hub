import { GoogleGenAI, Modality } from '@google/genai'

import {
  playAudioChunk,
  startAudioCapture,
  startAudioPlayback,
  stopAudioCapture,
  stopAudioPlayback,
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
let currentOutputMode: import('./types').OutputMode = 'device'

// --- Audio output priority & input buffering ---
// We disable Gemini's automatic VAD and manually control turn-taking.
// While Gemini is outputting audio (isSpeaking=true), we buffer mic input.
// When Gemini signals turnComplete, we flush the buffer with activityStart/activityEnd.
// This prevents: feedback loops, self-interruption, and cut-off translations.
let isSpeaking = false
const inputAudioBuffer: Buffer[] = []
/** Whether we've signaled activityStart to Gemini for the current input batch */
let activityStarted = false
/** Accumulated input transcription chars since last activityEnd / translation */
let pendingInputChars = 0
/** Max chars of input transcription before forcing activityEnd to trigger translation */
const MAX_PENDING_CHARS = 150

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
 * Uses RMS with a logarithmic scale for natural meter behavior.
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

  if (rms < 0.000001) return 0
  const dbfs = 20 * Math.log10(rms)

  const minDb = -60
  const normalized = Math.max(0, Math.min(1, (dbfs - minDb) / -minDb))

  return normalized
}

/**
 * Mark that Gemini started speaking — buffer all mic input from now on.
 */
function onSpeakingStart() {
  if (isSpeaking) return
  isSpeaking = true
  logger.debug('Agent started speaking, buffering mic input')
}

/**
 * Mark that Gemini finished its turn — flush all buffered mic audio to Gemini
 * wrapped in activityStart/activityEnd signals.
 */
function onTurnComplete() {
  isSpeaking = false
  pendingInputChars = 0

  const bufferedCount = inputAudioBuffer.length
  logger.debug('Agent turn complete, flushing buffered input', {
    bufferedChunks: bufferedCount,
  })

  flushInputBuffer()
}

/**
 * Force an activityEnd to trigger Gemini to translate accumulated input.
 * Called when char limit or max speech duration is reached.
 * Clears silence/max timers since we're ending activity explicitly.
 */
function forceActivityEnd() {
  if (!currentSession) return

  if (silenceTimer) {
    clearTimeout(silenceTimer)
    silenceTimer = null
  }
  if (maxSpeechTimer) {
    clearTimeout(maxSpeechTimer)
    maxSpeechTimer = null
  }

  try {
    // If activity wasn't started, start it first so the end signal is valid
    if (!activityStarted) {
      currentSession.sendRealtimeInput({ activityStart: {} })
    }
    currentSession.sendRealtimeInput({ activityEnd: {} })
    activityStarted = false
    pendingInputChars = 0
    logger.debug('Forced activityEnd to trigger translation')
  } catch (error) {
    logger.error('Failed to send forced activityEnd', {
      error: String(error),
    })
  }
}

/**
 * Send all buffered mic audio chunks to Gemini, wrapped in
 * manual activityStart/activityEnd signals so Gemini knows
 * this is a coherent batch of user speech.
 */
function flushInputBuffer() {
  if (!currentSession || inputAudioBuffer.length === 0) return

  const chunks = inputAudioBuffer.splice(0)

  try {
    // Signal that user speech is starting
    currentSession.sendRealtimeInput({ activityStart: {} })

    for (const chunk of chunks) {
      currentSession.sendRealtimeInput({
        audio: {
          data: chunk.toString('base64'),
          mimeType: 'audio/pcm;rate=16000',
        },
      })
    }

    // Signal that user speech batch is done — Gemini can now process and respond
    currentSession.sendRealtimeInput({ activityEnd: {} })
    activityStarted = false
  } catch (error) {
    logger.error('Failed to flush buffered audio', { error: String(error) })
  }
}

export async function startTranslation(
  config: LiveTranslationConfig,
): Promise<void> {
  if (currentSession) {
    logger.warn('Translation session already active, stopping first')
    await stopTranslation()
  }

  currentOutputMode = config.outputMode ?? 'device'

  // Reset state
  isSpeaking = false
  activityStarted = false
  pendingInputChars = 0
  inputAudioBuffer.length = 0

  logger.info('Starting live translation session', {
    source: config.sourceLanguage,
    target: config.targetLanguage,
    voice: config.voiceName,
    outputMode: currentOutputMode,
  })

  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey })

  const systemPrompt = buildSystemPrompt(
    config.sourceLanguage,
    config.targetLanguage,
  )

  // Start playback BEFORE connecting so it's ready when Gemini sends audio
  const useDevice =
    currentOutputMode === 'device' || currentOutputMode === 'both'
  if (useDevice) {
    await startAudioPlayback(config.outputDeviceId)
  }

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
      // Disable automatic VAD — we manually control turn-taking
      // so Gemini never interrupts itself from speaker/playback audio
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: true,
        },
      },
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

        await startAudioCapture((pcmBuffer) => {
          handleMicInput(pcmBuffer)
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
        stopAudioCapture()
        stopAudioPlayback()
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
}

/**
 * Handle mic input with manual turn-taking:
 * - When Gemini is speaking (isSpeaking): buffer all mic audio
 * - When Gemini is silent: always send audio, manage activityStart/activityEnd
 *
 * Three triggers force activityEnd (= Gemini translates):
 * 1. Silence gap: 1.5s of low audio → speaker paused
 * 2. Max duration: 15s continuous speech → force a batch
 * 3. Char limit: 150+ chars of input transcription → enough text to translate
 */
let silenceTimer: ReturnType<typeof setTimeout> | null = null
let maxSpeechTimer: ReturnType<typeof setTimeout> | null = null
const SILENCE_THRESHOLD = 0.015 // Below this = silence (used for silence gap detection)
const SILENCE_GAP_MS = 1500
const MAX_SPEECH_DURATION_MS = 15000

function handleMicInput(pcmBuffer: Buffer): void {
  if (!currentSession) return

  const level = calculateAudioLevel(pcmBuffer)
  audioLevelCallback?.(level, 'input')
  updateState({ inputAudioLevel: level })

  if (isSpeaking) {
    // Agent is outputting audio — buffer mic input, don't send to Gemini
    inputAudioBuffer.push(pcmBuffer)
    return
  }

  // Ensure activity is started — we always send audio when agent is silent
  if (!activityStarted) {
    try {
      currentSession.sendRealtimeInput({ activityStart: {} })
      activityStarted = true
    } catch (error) {
      logger.error('Failed to send activityStart', { error: String(error) })
    }

    // Start max speech timer
    if (maxSpeechTimer) clearTimeout(maxSpeechTimer)
    maxSpeechTimer = setTimeout(() => {
      maxSpeechTimer = null
      if (activityStarted && !isSpeaking) {
        logger.debug('Max speech duration reached, forcing translation')
        forceActivityEnd()
      }
    }, MAX_SPEECH_DURATION_MS)
  }

  // Always send audio to Gemini
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

  // Silence detection for gap-based trigger
  const hasAudio = level > SILENCE_THRESHOLD
  if (hasAudio) {
    if (silenceTimer) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
  } else if (!silenceTimer) {
    silenceTimer = setTimeout(() => {
      silenceTimer = null
      if (activityStarted && !isSpeaking) {
        logger.debug('Silence gap detected, triggering translation')
        forceActivityEnd()
      }
    }, SILENCE_GAP_MS)
  }
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
    last.text += ' ' + text
    last.timestamp = Date.now()
    transcriptionCallback?.(last, 'update')
  } else {
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
      turnComplete?: boolean
      interrupted?: boolean
    }
  }

  if (!msg.serverContent) return

  // Handle input transcription (what the speaker said)
  if (msg.serverContent.inputTranscription?.text) {
    const text = msg.serverContent.inputTranscription.text.trim()
    if (text) {
      appendOrCreateEntry(text, 'source')

      // Track accumulated chars — force translation when threshold is reached
      pendingInputChars += text.length
      if (pendingInputChars >= MAX_PENDING_CHARS && !isSpeaking) {
        logger.debug('Char limit reached, forcing translation', {
          pendingChars: pendingInputChars,
        })
        forceActivityEnd()
      }
    }
  }

  // Handle output transcription (what Gemini translated)
  if (msg.serverContent.outputTranscription?.text) {
    const text = msg.serverContent.outputTranscription.text.trim()
    if (text) {
      appendOrCreateEntry(text, 'translation')
    }
  }

  // Handle audio output from Gemini
  if (msg.serverContent.modelTurn?.parts) {
    for (const part of msg.serverContent.modelTurn.parts) {
      if (part.inlineData?.data) {
        const pcmBuffer = Buffer.from(part.inlineData.data, 'base64')
        const level = calculateAudioLevel(pcmBuffer)
        audioLevelCallback?.(level, 'output')
        updateState({ outputAudioLevel: level })
        audioOutputCallback?.(pcmBuffer)

        // Mark agent as speaking — this starts buffering mic input
        onSpeakingStart()

        // Play audio through server speakers (only if device output enabled)
        const useDeviceOutput =
          currentOutputMode === 'device' || currentOutputMode === 'both'
        if (useDeviceOutput) {
          playAudioChunk(pcmBuffer)
        }
      }
    }
  }

  // Handle turn completion — Gemini finished its translation output.
  // This is the signal to flush buffered mic audio.
  if (msg.serverContent.turnComplete) {
    logger.debug('Gemini turn complete')
    onTurnComplete()
  }

  // Handle interruption — Gemini was interrupted (should not happen with
  // manual VAD, but handle gracefully)
  if (msg.serverContent.interrupted) {
    logger.warn('Gemini was interrupted')
    onTurnComplete()
  }
}

export async function stopTranslation(): Promise<void> {
  if (!currentSession) return

  logger.info('Stopping live translation session')

  stopAudioCapture()
  stopAudioPlayback()

  // Clear state
  if (silenceTimer) {
    clearTimeout(silenceTimer)
    silenceTimer = null
  }
  if (maxSpeechTimer) {
    clearTimeout(maxSpeechTimer)
    maxSpeechTimer = null
  }
  isSpeaking = false
  activityStarted = false
  pendingInputChars = 0
  inputAudioBuffer.length = 0

  try {
    currentSession.close()
  } catch (error) {
    logger.error('Error closing session', { error: String(error) })
  }

  currentSession = null
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

  return [
    `You are a professional simultaneous interpreter translating from ${sourceName} to ${targetName}.`,
    ``,
    `## Core rules`,
    `- Listen to the speaker in ${sourceName} and translate into ${targetName}.`,
    `- ONLY translate speech in ${sourceName}. Completely IGNORE any audio in ${targetName} — that is your own translated voice being played back through speakers. Never translate or respond to it.`,
    `- Do NOT add commentary, explanations, greetings, or filler words. ONLY output the translation.`,
    `- If there is silence, remain silent. Do NOT speak when there is nothing to translate.`,
    ``,
    `## Translation timing and completeness`,
    `- Always translate COMPLETE sentences. Never cut off mid-sentence.`,
    `- If the speaker pauses mid-sentence, wait for them to finish before translating.`,
    `- After the speaker completes 1-3 sentences, translate them immediately — do not wait for more.`,
    `- If the speaker has been talking continuously for a while, translate the complete sentences you have so far. Do NOT accumulate more than 3 sentences before translating.`,
    `- CRITICAL: NEVER drop, skip, or forget any content. Every single sentence the speaker says MUST be translated, in order. If you had to wait while the speaker continued, translate ALL pending sentences when you speak.`,
    `- After you finish translating a batch, if the speaker said more sentences while you were translating, translate those next. Keep translating until you have caught up with everything the speaker said.`,
    ``,
    `## Voice and intonation`,
    `- Match the speaker's intonation, emotion, and energy level as closely as possible.`,
    `- If the speaker is passionate and loud, speak with passion and energy.`,
    `- If the speaker is calm and gentle, speak calmly and gently.`,
    `- If the speaker emphasizes a word, emphasize the equivalent word in translation.`,
    `- Preserve the speaker's pacing — speak at a similar speed to the original.`,
    `- Use natural prosody for ${targetName} — the translation should sound like a native ${targetName} speaker delivering the same message with the same emotion.`,
  ].join('\n')
}
