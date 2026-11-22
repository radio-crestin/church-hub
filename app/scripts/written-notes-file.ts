import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { WrittenNotes } from '../apps/client/src/features/release-notes/types'

/** The notes Claude wrote for each released version, by version (save-written-notes.ts). */
export const WRITTEN_NOTES_FILE = join(
  import.meta.dir,
  '..',
  'apps',
  'client',
  'src',
  'features',
  'release-notes',
  'written-notes.json',
)

export function readWrittenNotes(): Record<string, WrittenNotes> {
  if (!existsSync(WRITTEN_NOTES_FILE)) return {}
  return JSON.parse(readFileSync(WRITTEN_NOTES_FILE, 'utf-8'))
}
