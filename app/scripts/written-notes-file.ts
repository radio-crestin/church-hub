import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { isWrittenNotes } from '../apps/client/src/features/release-notes/service/writtenNotesBlock'
import type { WrittenNotes } from '../apps/client/src/features/release-notes/types'

/**
 * The plain-language notes of each version, by version, in English and
 * Romanian: written by the agent cutting the release (the release-notes
 * skill), required by scripts/release.sh, bundled by generate-changelog.ts.
 */
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

/** Every version's notes; throws on an entry the app could not show. */
export function readWrittenNotes(): Record<string, WrittenNotes> {
  if (!existsSync(WRITTEN_NOTES_FILE)) return {}
  const all = JSON.parse(readFileSync(WRITTEN_NOTES_FILE, 'utf-8')) as Record<
    string,
    unknown
  >
  for (const [version, notes] of Object.entries(all)) {
    if (!isWrittenNotes(notes)) {
      throw new Error(
        `${WRITTEN_NOTES_FILE}: v${version} needs en and ro, each with features and bugFixes lists of sentences`,
      )
    }
  }
  return all as Record<string, WrittenNotes>
}
