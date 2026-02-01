export interface LiveTranslationConfig {
  sourceLanguage: string
  targetLanguage: string
  voiceName: string
  geminiApiKey: string
  inputDeviceId?: number
  outputDeviceId?: number
  muteWhileSpeaking?: boolean
}

export interface LiveTranslationState {
  isActive: boolean
  sourceLanguage: string
  targetLanguage: string
  inputAudioLevel: number
  outputAudioLevel: number
  transcription: TranscriptionEntry[]
  error?: string
  startedAt: number | null
}

export interface TranscriptionEntry {
  id: string
  text: string
  type: 'source' | 'translation'
  timestamp: number
}

export const DEFAULT_TRANSLATION_STATE: LiveTranslationState = {
  isActive: false,
  sourceLanguage: 'ro',
  targetLanguage: 'en',
  inputAudioLevel: 0,
  outputAudioLevel: 0,
  transcription: [],
  startedAt: null,
}
