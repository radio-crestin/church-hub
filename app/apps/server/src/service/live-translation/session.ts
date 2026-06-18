import {
  playAudioChunk,
  startAudioCapture,
  startAudioPlayback,
  stopAudioCapture,
  stopAudioPlayback,
} from './audio-io'
import { createEngineSession, type EngineSession } from './engines'
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

/**
 * Join a streaming transcription delta onto the running text. The Gemini
 * live-translate model emits transcription in word/phrase fragments that do
 * NOT carry surrounding spaces (unlike the previous engines), so concatenating
 * directly ran words together. Insert a space between word fragments, but not
 * when either side already provides whitespace, not before punctuation that
 * attaches to the preceding word, and not after an opening bracket/quote.
 */
function joinTranscriptDelta(prev: string, delta: string): string {
  if (!prev) return delta.replace(/^\s+/, '')
  if (!delta) return prev
  if (/\s$/.test(prev) || /^\s/.test(delta)) return prev + delta
  // Punctuation that hugs the preceding word — no leading space.
  if (/^[.,!?;:)\]}%…»"']/.test(delta)) return prev + delta
  // Opening punctuation at the end of prev — no trailing space.
  if (/[([{«¿¡]$/.test(prev)) return prev + delta
  return `${prev} ${delta}`
}

// Tracks the in-progress transcription entry per "segment" so streamed updates
// modify one line and each finished utterance becomes a new line. Key:
// 'source' for the shared source transcript, `translation:<targetId>` per target.
const openSegmentEntryId = new Map<string, string>()

function segmentKey(type: 'source' | 'translation', targetId?: string): string {
  return type === 'source' ? 'source' : `translation:${targetId ?? ''}`
}

/**
 * Add or update a transcription line.
 *
 * The Gemini 3.x live models deliver the full utterance text (often re-sending
 * a growing snapshot) rather than pure deltas, so naive `+=` produced garbled,
 * duplicated text. We therefore: replace when the new text is a longer snapshot
 * of the current line, ignore exact/shorter duplicates, and only word-join when
 * it is a genuine delta. `closeTranscriptSegments` (called on turn end) ends the
 * current utterance so the next text starts a fresh line.
 */
function upsertTranscript(
  text: string,
  type: 'source' | 'translation',
  target?: TranslationTarget,
): void {
  const trimmed = text.trim()
  if (!trimmed) return

  const key = segmentKey(type, target?.id)
  const openId = openSegmentEntryId.get(key)
  const existing = openId
    ? currentState.transcription.find((e) => e.id === openId)
    : undefined

  if (existing) {
    const prev = existing.text
    if (trimmed === prev) return
    let next: string
    if (trimmed.startsWith(prev)) {
      next = trimmed // growing snapshot of the same utterance
    } else if (prev.startsWith(trimmed)) {
      return // older / shorter snapshot of what we already have
    } else {
      next = joinTranscriptDelta(prev, trimmed) // genuine delta
    }
    existing.text = next
    existing.timestamp = Date.now()
    transcriptionCallback?.(existing, 'update')
  } else {
    const entry: TranscriptionEntry = {
      id: generateId(),
      text: trimmed,
      type,
      targetId: target?.id,
      targetLanguage: target?.targetLanguage,
      timestamp: Date.now(),
    }
    currentState.transcription.push(entry)
    if (currentState.transcription.length > 200) {
      currentState.transcription = currentState.transcription.slice(-200)
    }
    openSegmentEntryId.set(key, entry.id)
    transcriptionCallback?.(entry, 'add')
  }
  // transcriptionCallback already streamed the granular update; skip the
  // full-state broadcast to keep updates real-time.
  mutateState({ transcription: currentState.transcription })
}

/** End the current utterance(s) so subsequent text starts on a new line. */
function closeTranscriptSegments(targetId?: string): void {
  if (targetId) openSegmentEntryId.delete(`translation:${targetId}`)
  openSegmentEntryId.delete('source')
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

  const apiKey = config.geminiApiKey
  if (!apiKey) {
    throw new Error('Gemini API key is required')
  }

  currentOutputMode = config.outputMode ?? 'webrtc'
  primaryTargetId = config.primaryTargetId ?? config.targets[0]?.id

  logger.info('Starting live translation session', {
    source: config.sourceLanguage,
    targets: config.targets.map((t) => t.targetLanguage),
    outputMode: currentOutputMode,
  })

  currentState = {
    ...DEFAULT_TRANSLATION_STATE,
    sourceLanguage: config.sourceLanguage,
    primaryTargetId,
    isActive: true,
    startedAt: Date.now(),
    targets: config.targets.map((t) => ({
      id: t.id,
      targetLanguage: t.targetLanguage,
      outputAudioLevel: 0,
      listenerCount: 0,
    })),
    transcription: [],
  }
  stateCallback?.(currentState)

  const useDevice =
    currentOutputMode === 'device' || currentOutputMode === 'both'
  if (useDevice) {
    await startAudioPlayback(config.outputDeviceId)
  }

  for (const target of config.targets) {
    try {
      const engine = await createEngineSession(
        {
          apiKey,
          sourceLanguage: config.sourceLanguage,
          targetLanguage: target.targetLanguage,
          targetId: target.id,
        },
        {
          onAudioOutput: (pcm) => handleEngineAudio(target, pcm),
          onSourceText: (text) => {
            // Every target's engine transcribes the SAME source audio, so only
            // take the source transcript from the primary engine — otherwise
            // the source line is duplicated once per target.
            if (target.id === primaryTargetId) upsertTranscript(text, 'source')
          },
          onTargetText: (text) => upsertTranscript(text, 'translation', target),
          onSpeakingStart: () => {
            // handled per-engine (used to pause input)
          },
          onTurnComplete: () => {
            // End the current utterance so the next text starts a new line.
            closeTranscriptSegments(target.id)
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
  openSegmentEntryId.clear()

  currentState = { ...DEFAULT_TRANSLATION_STATE }
  stateCallback?.(currentState)
}

export function clearTranscription(): void {
  currentState.transcription = []
  openSegmentEntryId.clear()
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
