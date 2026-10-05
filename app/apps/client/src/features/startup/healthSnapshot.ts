import type { StartupStepKey } from './startupText'

/** The server's `/health` answer (boot server and real server). */
export interface HealthSnapshot {
  phase?: string
  message?: string
  ready?: boolean
  error?: { phase: string; message: string } | null
  step?: StartupStepKey | null
  progress?: { done: number; total: number } | null
  firstRun?: boolean
}
