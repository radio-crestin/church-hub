export type OutputMode = 'device' | 'webrtc' | 'both'

/** Whether engines synthesize a spoken translation or only produce text. */
export type OutputModality = 'audio_text' | 'text_only'

export type TranslationEngine = 'openai' | 'gemini'

export interface TranslationTarget {
  id: string
  targetLanguage: string
  voiceName: string
}

export interface LiveTranslationConfig {
  engine: TranslationEngine
  outputModality: OutputModality
  sourceLanguage: string
  targets: TranslationTarget[]
  primaryTargetId?: string
  openaiApiKey?: string
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
  voiceName: string
  outputAudioLevel: number
  listenerCount: number
}

export interface LiveTranslationState {
  isActive: boolean
  engine: TranslationEngine
  outputModality: OutputModality
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
  engine: 'openai',
  outputModality: 'audio_text',
  sourceLanguage: 'ro',
  inputAudioLevel: 0,
  outputAudioLevel: 0,
  transcription: [],
  targets: [],
  startedAt: null,
}

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

export function buildSystemPrompt(
  sourceLanguage: string,
  targetLanguage: string,
): string {
  const sourceName = LANGUAGE_NAMES[sourceLanguage] || sourceLanguage
  const targetName = LANGUAGE_NAMES[targetLanguage] || targetLanguage

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
