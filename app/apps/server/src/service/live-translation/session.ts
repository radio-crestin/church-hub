import {
  playAudioChunk,
  startAudioCapture,
  startAudioPlayback,
  stopAudioCapture,
  stopAudioPlayback,
} from './audio-io'
import {
  createEngineSession,
  type EngineSession,
} from './engines'
import type {
  LiveTranslationConfig,
  LiveTranslationState,
  OutputMode,
  TranscriptionEntry,
  TranslationTarget,
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
type AudioOutputCallback = (targetId: string, pcmData: Buffer) => void
type TranscriptionCallback = (
  entry: TranscriptionEntry,
  action: 'add' | 'update',
) => void
type AudioLevelCallback = (
  level: number,
  type: 'input' | 'output',
  targetId?: string,
) => void

interface RunningTarget {
  target: TranslationTarget
  engine: EngineSession
  outputLevel: number
}

const runningTargets = new Map<string, RunningTarget>()
let currentState: LiveTranslationState = { ...DEFAULT_TRANSLATION_STATE }
let stateCallback: StateCallback | null = null
let audioOutputCallback: AudioOutputCallback | null = null
let transcriptionCallback: TranscriptionCallback | null = null
let audioLevelCallback: AudioLevelCallback | null = null
let transcriptionIdCounter = 0
let currentOutputMode: OutputMode = 'device'
let primaryTargetId: string | undefined
let capturing = false

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

/** Mutate currentState without firing the (large) full-state broadcast. Use
 *  this for high-frequency or already-narrowly-broadcast updates (audio
 *  levels, transcription deltas). The dedicated event channel for that
 *  signal is responsible for notifying clients. */
function mutateState(partial: Partial<LiveTranslationState>) {
  currentState = { ...currentState, ...partial }
}

function generateId(): string {
  return `t-${Date.now()}-${++transcriptionIdCounter}`
}

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
  return Math.max(0, Math.min(1, (dbfs - minDb) / -minDb))
}

function appendOrCreateEntry(
  text: string,
  type: 'source' | 'translation',
  target?: TranslationTarget,
): void {
  const last =
    currentState.transcription[currentState.transcription.length - 1]

  const sameBucket =
    last &&
    last.type === type &&
    (type === 'source'
      ? !target || last.targetId === target.id || !last.targetId
      : last.targetId === target?.id)

  if (sameBucket && last) {
    // Engine deltas already carry their own whitespace; concatenate directly.
    // (Old behavior injected a space, which mangled sub-word deltas like
    // "Hel" + "lo" into "Hel lo".)
    last.text += text
    last.timestamp = Date.now()
    transcriptionCallback?.(last, 'update')
  } else {
    const entry: TranscriptionEntry = {
      id: generateId(),
      // Trim leading whitespace on the first chunk only — engines often
      // emit a leading space on the first delta of a new segment.
      text: text.replace(/^\s+/, ''),
      type,
      targetId: target?.id,
      targetLanguage: target?.targetLanguage,
      timestamp: Date.now(),
    }
    currentState.transcription.push(entry)
    if (currentState.transcription.length > 200) {
      currentState.transcription = currentState.transcription.slice(-200)
    }
    transcriptionCallback?.(entry, 'add')
  }
  // No full-state broadcast here — transcriptionCallback already streamed
  // the granular update to clients. Skipping the wire round-trip for the
  // whole transcription array keeps deltas truly real-time.
  mutateState({ transcription: currentState.transcription })
}

function handleMicInput(pcmBuffer: Buffer): void {
  const level = calculateAudioLevel(pcmBuffer)
  audioLevelCallback?.(level, 'input')
  // Audio level fires ~50 Hz — use the dedicated translation_audio_level
  // event (already broadcast above); don't pile a full-state broadcast
  // on top of it or transcription deltas get stuck behind a fat queue.
  mutateState({ inputAudioLevel: level })
  for (const rt of runningTargets.values()) {
    rt.engine.sendAudio(pcmBuffer)
  }
}

export async function startTranslation(
  config: LiveTranslationConfig,
): Promise<void> {
  if (runningTargets.size > 0) {
    logger.warn('Translation session already active, stopping first')
    await stopTranslation()
  }

  if (!config.targets || config.targets.length === 0) {
    throw new Error('At least one target language is required')
  }

  const apiKey =
    config.engine === 'gemini' ? config.geminiApiKey : config.openaiApiKey
  if (!apiKey) {
    throw new Error(
      `${config.engine === 'gemini' ? 'Gemini' : 'OpenAI'} API key is required`,
    )
  }

  currentOutputMode = config.outputMode ?? 'device'
  primaryTargetId = config.primaryTargetId ?? config.targets[0]?.id

  logger.info('Starting live translation session', {
    engine: config.engine,
    source: config.sourceLanguage,
    targets: config.targets.map((t) => t.targetLanguage),
    outputMode: currentOutputMode,
  })

  const outputModality = config.outputModality ?? 'audio_text'
  currentState = {
    ...DEFAULT_TRANSLATION_STATE,
    engine: config.engine,
    outputModality,
    sourceLanguage: config.sourceLanguage,
    primaryTargetId,
    isActive: true,
    startedAt: Date.now(),
    targets: config.targets.map((t) => ({
      id: t.id,
      targetLanguage: t.targetLanguage,
      voiceName: t.voiceName,
      outputAudioLevel: 0,
      listenerCount: 0,
    })),
    transcription: [],
  }
  stateCallback?.(currentState)

  // Device playback only makes sense when the engine actually returns audio
  const useDevice =
    outputModality === 'audio_text' &&
    (currentOutputMode === 'device' || currentOutputMode === 'both')
  if (useDevice) {
    await startAudioPlayback(config.outputDeviceId)
  }

  for (const target of config.targets) {
    try {
      const engine = await createEngineSession(
        {
          engine: config.engine,
          outputModality,
          apiKey,
          sourceLanguage: config.sourceLanguage,
          targetLanguage: target.targetLanguage,
          voiceName: target.voiceName,
          targetId: target.id,
        },
        {
          onAudioOutput: (pcm) => handleEngineAudio(target, pcm),
          onSourceText: (text) => appendOrCreateEntry(text, 'source', target),
          onTargetText: (text) =>
            appendOrCreateEntry(text, 'translation', target),
          onSpeakingStart: () => {
            // handled per-engine (used to pause input)
          },
          onTurnComplete: () => {
            // ignore — output level decay handled by audio chunks
          },
          onError: (err) => {
            logger.error('Engine error', {
              targetId: target.id,
              error: err,
            })
            updateState({ error: err })
          },
          onClose: () => {
            logger.info('Engine closed', { targetId: target.id })
          },
        },
      )
      runningTargets.set(target.id, { target, engine, outputLevel: 0 })
    } catch (err) {
      logger.error('Failed to start engine', {
        targetId: target.id,
        error: String(err),
      })
      // Tear down anything started so far
      for (const rt of runningTargets.values()) await rt.engine.close()
      runningTargets.clear()
      if (useDevice) stopAudioPlayback()
      throw err
    }
  }

  // Start mic capture only after all engines are ready
  await startAudioCapture((pcmBuffer) => {
    handleMicInput(pcmBuffer)
  }, config.inputDeviceId)
  capturing = true
}

function handleEngineAudio(target: TranslationTarget, pcm: Buffer): void {
  const level = calculateAudioLevel(pcm)
  const rt = runningTargets.get(target.id)
  if (rt) rt.outputLevel = level
  audioLevelCallback?.(level, 'output', target.id)

  // Update primary target's output level on top-level state for back-compat.
  // High-frequency — narrow-broadcast only via audioLevelCallback above.
  if (target.id === primaryTargetId) {
    mutateState({ outputAudioLevel: level })
  }

  audioOutputCallback?.(target.id, pcm)

  // Play primary target audio locally
  const useDevice =
    currentOutputMode === 'device' || currentOutputMode === 'both'
  if (useDevice && target.id === primaryTargetId) {
    playAudioChunk(pcm)
  }
}

export async function stopTranslation(): Promise<void> {
  if (runningTargets.size === 0 && !capturing) return

  logger.info('Stopping live translation session')

  if (capturing) {
    stopAudioCapture()
    capturing = false
  }
  stopAudioPlayback()

  for (const rt of runningTargets.values()) {
    try {
      await rt.engine.close()
    } catch (err) {
      logger.error('Error closing engine', { error: String(err) })
    }
  }
  runningTargets.clear()

  currentState = { ...DEFAULT_TRANSLATION_STATE }
  stateCallback?.(currentState)
}

export function clearTranscription(): void {
  currentState.transcription = []
  updateState({ transcription: [] })
}

export function isTranslationActive(): boolean {
  return currentState.isActive
}

export function updateListenerCounts(counts: Record<string, number>): void {
  const targets = currentState.targets.map((t) => ({
    ...t,
    listenerCount: counts[t.id] ?? 0,
  }))
  updateState({ targets })
}

export function getActiveTargets(): TranslationTarget[] {
  return Array.from(runningTargets.values()).map((rt) => rt.target)
}
