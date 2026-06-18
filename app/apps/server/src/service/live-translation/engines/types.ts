export interface EngineSessionConfig {
  apiKey: string
  sourceLanguage: string
  targetLanguage: string
  targetId: string
}

export interface EngineHandlers {
  onAudioOutput: (pcm24khz: Buffer) => void
  onSourceText: (text: string) => void
  onTargetText: (text: string) => void
  onSpeakingStart: () => void
  onTurnComplete: () => void
  onError: (err: string) => void
  onClose: () => void
}

export interface EngineSession {
  readonly targetId: string
  sendAudio(pcm16khz: Buffer): void
  close(): Promise<void>
  isSpeaking(): boolean
}
