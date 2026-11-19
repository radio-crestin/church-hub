/** How the preacher microphone is cleaned before translation. */
export type VoiceIsolation = 'off' | 'inworld'

export const VOICE_ISOLATIONS: readonly VoiceIsolation[] = ['off', 'inworld']

/**
 * Where the microphone's isolation stands during a session: `starting`
 * while the engine loads (raw audio goes through), `bypassed` when it failed
 * or fell behind (raw audio goes through for the rest of the session).
 */
export type VoiceIsolationStatus = 'off' | 'starting' | 'active' | 'bypassed'

export type InworldSetupStep = 'venv' | 'install' | 'download' | 'benchmark'

export interface InworldSetupProgress {
  step: InworldSetupStep
  /** Bytes received and expected, while the weights download. */
  received?: number
  total?: number
}

export interface InworldStatus {
  /** The system Python the helper's venv is made from; null: none found. */
  python: string | null
  installed: boolean
  modelReady: boolean
  /** The device and real-time factor of the last benchmark (< 1 keeps up). */
  device?: string
  realTimeFactor?: number
  setup: InworldSetupProgress | null
  error?: string
}
