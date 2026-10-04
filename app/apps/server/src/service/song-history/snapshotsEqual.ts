import type { SongSnapshot } from './types'

export function snapshotsEqual(a: SongSnapshot, b: SongSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
