import { defaultVoiceForEngine } from './engines'
import type {
  OutputModality,
  TranslationEngine,
  TranslationTarget,
} from './types'

export interface PersistedSettings {
  engine: TranslationEngine
  outputModality: OutputModality
  sourceLanguage: string
  targets: TranslationTarget[]
  primaryTargetId?: string
  geminiApiKey?: string
  openaiApiKey?: string
  inputDeviceId?: number | null
  outputDeviceId?: number | null
  outputMode?: 'device' | 'webrtc' | 'both'
}

export function generateTargetId(): string {
  return `tgt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function defaultSettings(): PersistedSettings {
  return {
    engine: 'openai',
    outputModality: 'audio_text',
    sourceLanguage: 'ro',
    targets: [
      {
        id: generateTargetId(),
        targetLanguage: 'en',
        voiceName: defaultVoiceForEngine('openai'),
      },
    ],
    geminiApiKey: '',
    openaiApiKey: '',
    inputDeviceId: null,
    outputDeviceId: null,
    outputMode: 'device',
  }
}

/**
 * Migrate legacy single-target settings shape
 *   { sourceLanguage, targetLanguage, voiceName, geminiApiKey, ... }
 * into the multi-target shape with targets[]. Also fills in defaults for
 * fields added later (engine, outputModality).
 */
export function migrateSettings(raw: unknown): PersistedSettings {
  const obj = (raw as Record<string, unknown>) || {}
  const defaults = defaultSettings()

  const engine: TranslationEngine =
    obj.engine === 'gemini' || obj.engine === 'openai'
      ? obj.engine
      : defaults.engine

  let targets: TranslationTarget[]
  if (Array.isArray(obj.targets) && obj.targets.length > 0) {
    targets = (obj.targets as Array<Record<string, unknown>>).map((t) => ({
      id: typeof t.id === 'string' ? t.id : generateTargetId(),
      targetLanguage:
        typeof t.targetLanguage === 'string' ? t.targetLanguage : 'en',
      voiceName:
        typeof t.voiceName === 'string'
          ? t.voiceName
          : defaultVoiceForEngine(engine),
    }))
  } else {
    targets = [
      {
        id: generateTargetId(),
        targetLanguage:
          typeof obj.targetLanguage === 'string' ? obj.targetLanguage : 'en',
        voiceName:
          typeof obj.voiceName === 'string'
            ? obj.voiceName
            : defaultVoiceForEngine(engine),
      },
    ]
  }

  const outputModality: OutputModality =
    obj.outputModality === 'text_only' ? 'text_only' : 'audio_text'

  return {
    engine,
    outputModality,
    sourceLanguage:
      typeof obj.sourceLanguage === 'string' ? obj.sourceLanguage : 'ro',
    targets,
    primaryTargetId:
      typeof obj.primaryTargetId === 'string'
        ? obj.primaryTargetId
        : targets[0]?.id,
    geminiApiKey:
      typeof obj.geminiApiKey === 'string' ? obj.geminiApiKey : undefined,
    openaiApiKey:
      typeof obj.openaiApiKey === 'string' ? obj.openaiApiKey : undefined,
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
