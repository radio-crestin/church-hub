import { invoke } from '@tauri-apps/api/core'

/**
 * How the previous launch's update went, as worked out by the Rust side
 * from the marker written before the installer ran.
 */
export type UpdateOutcome =
  | { status: 'updated'; from: string; to: string }
  | { status: 'failed'; from: string; to: string; current: string }

/** Handed out once: the second caller gets null. */
export function takeUpdateOutcome(): Promise<UpdateOutcome | null> {
  return invoke<UpdateOutcome | null>('take_update_outcome')
}
