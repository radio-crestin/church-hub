import type { TranslationTarget } from './types'

export interface PersistedSettings {
  sourceLanguage: string
  targets: TranslationTarget[]
  primaryTargetId?: string
  geminiApiKey?: string
  inputDeviceId?: number | null
  outputDeviceId?: number | null
  outputMode?: 'device' | 'webrtc' | 'both'
}

export function generateTargetId(): string {
  return `tgt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function defaultSettings(): PersistedSettings {
  return {
    sourceLanguage: 'ro',
    targets: [
      {
        id: generateTargetId(),
        targetLanguage: 'en',
      },
    ],
    geminiApiKey: '',
    inputDeviceId: null,
    outputDeviceId: null,
    outputMode: 'device',
  }
}

/**
 * Normalise persisted settings into the current shape. Handles:
 *  - the legacy single-target shape ({ sourceLanguage, targetLanguage, ... })
 *    by wrapping it into targets[]
 *  - legacy fields from the old multi-engine feature (engine, outputModality,
 *    openaiApiKey, per-target voiceName), which are simply dropped — the
 *    feature now runs on a single Gemini live-translate model with no voice
 *    or engine selection.
 */
export function migrateSettings(raw: unknown): PersistedSettings {
  const obj = (raw as Record<string, unknown>) || {}
  const defaults = defaultSettings()

  let targets: TranslationTarget[]
  if (Array.isArray(obj.targets) && obj.targets.length > 0) {
    targets = (obj.targets as Array<Record<string, unknown>>).map((t) => ({
      id: typeof t.id === 'string' ? t.id : generateTargetId(),
      targetLanguage:
        typeof t.targetLanguage === 'string' ? t.targetLanguage : 'en',
    }))
  } else {
    targets = [
      {
        id: generateTargetId(),
        targetLanguage:
          typeof obj.targetLanguage === 'string' ? obj.targetLanguage : 'en',
      },
    ]
  }

  return {
    sourceLanguage:
      typeof obj.sourceLanguage === 'string' ? obj.sourceLanguage : 'ro',
    targets,
    primaryTargetId:
      typeof obj.primaryTargetId === 'string'
        ? obj.primaryTargetId
        : targets[0]?.id,
    geminiApiKey:
      typeof obj.geminiApiKey === 'string' ? obj.geminiApiKey : undefined,
    inputDeviceId:
      typeof obj.inputDeviceId === 'number' ? obj.inputDeviceId : null,
    outputDeviceId:
      typeof obj.outputDeviceId === 'number' ? obj.outputDeviceId : null,
    outputMode:
      obj.outputMode === 'device' ||
      obj.outputMode === 'webrtc' ||
      obj.outputMode === 'both'
        ? obj.outputMode
        : defaults.outputMode,
  }
}
