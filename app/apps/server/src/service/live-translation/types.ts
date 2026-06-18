export type OutputMode = 'device' | 'webrtc' | 'both'

export interface TranslationTarget {
  id: string
  targetLanguage: string
}

export interface LiveTranslationConfig {
  sourceLanguage: string
  targets: TranslationTarget[]
  primaryTargetId?: string
  geminiApiKey?: string
  inputDeviceId?: number
  outputDeviceId?: number
  outputMode?: OutputMode
}

export interface TranscriptionEntry {
  id: string
  text: string
  type: 'source' | 'translation'
  targetId?: string
  targetLanguage?: string
  timestamp: number
}

export interface TargetState {
  id: string
  targetLanguage: string
  outputAudioLevel: number
  listenerCount: number
}

export interface LiveTranslationState {
  isActive: boolean
  sourceLanguage: string
  inputAudioLevel: number
  outputAudioLevel: number
  transcription: TranscriptionEntry[]
  targets: TargetState[]
  primaryTargetId?: string
  error?: string
  startedAt: number | null
}

export const DEFAULT_TRANSLATION_STATE: LiveTranslationState = {
  isActive: false,
  sourceLanguage: 'ro',
  inputAudioLevel: 0,
  outputAudioLevel: 0,
  transcription: [],
  targets: [],
  startedAt: null,
}

/** Display names for the languages offered in the UI. */
export const LANGUAGE_NAMES: Record<string, string> = {
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

/**
 * The Gemini live-translate model wants a BCP-47 target language code. Our
 * internal codes already match for most languages; only a couple need a region
 * subtag to be accepted by the model. Everything else passes through unchanged.
 *
 * See the supported-language table at
 * https://ai.google.dev/gemini-api/docs/live-api/live-translate
 */
const BCP47_OVERRIDES: Record<string, string> = {
  pt: 'pt-BR',
  zh: 'zh-Hans',
}

export function toBcp47(languageCode: string): string {
  return BCP47_OVERRIDES[languageCode] ?? languageCode
}
