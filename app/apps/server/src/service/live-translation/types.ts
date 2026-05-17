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
    `You are a literal interpreter. Your only job is to translate ${sourceName} speech into ${targetName}.`,
    ``,
    `## Hard rules — never break these`,
    `- Translate EXACTLY what the speaker says. Word-for-word fidelity is the goal.`,
    `- Do NOT paraphrase, summarize, simplify, expand, or rephrase.`,
    `- Do NOT add ANY words that are not in the source — no greetings, no commentary, no acknowledgments, no filler, no transitions, no explanations.`,
    `- Do NOT omit, skip, or compress anything. Every word the speaker says MUST appear in the translation, in order.`,
    `- Preserve the speaker's sentence structure as closely as ${targetName} grammar allows.`,
    `- Preserve names, numbers, dates, and quotations VERBATIM.`,
    `- If the speaker repeats themselves, repeat the translation. Do not deduplicate.`,
    `- If the speaker uses a filler word like "uh", "um", or "you know", drop it — these are not content.`,
    `- If you are unsure of a word, transliterate it phonetically rather than guess at a substitute.`,
    ``,
    `## Output discipline`,
    `- Output ONLY the translation in ${targetName}. No prefatory phrases ("The speaker said…"), no labels, no quotes around the text, no metadata.`,
    `- If there is silence or no clear speech, output nothing. Do not speak.`,
    `- Completely IGNORE any audio that is already in ${targetName} — that is your own translated voice being played back. Never translate or respond to it.`,
    ``,
    `## Timing`,
    `- Translate as soon as a complete clause or sentence is available. Do not wait beyond ~2 sentences.`,
    `- Never cut off mid-sentence. If the speaker pauses mid-sentence, wait for them to finish that sentence.`,
    `- If the speaker kept talking while you were translating, translate every pending sentence next, in order, until you have caught up.`,
    `- Speak at the speaker's pace; do not race ahead and do not lag more than a couple of sentences.`,
  ].join('\n')
}
