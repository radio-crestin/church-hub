import type { WrittenNotes } from '../types'

/**
 * The written notes travel in the GitHub release body as one HTML comment,
 * invisible on the release page: `<!-- church-hub-notes {json} -->`. The
 * release CI writes it (app/scripts/write-release-notes.ts), the app and
 * app/scripts/save-written-notes.ts read it back.
 */
const BLOCK = /<!--\s*church-hub-notes\s+(\{[\s\S]*?\})\s*-->/

export function renderWrittenNotesBlock(notes: WrittenNotes): string {
  // `--` can't appear inside an HTML comment: JSON escapes it.
  const json = JSON.stringify(notes).replace(/--/g, '-\\u002d')
  return `<!-- church-hub-notes ${json} -->`
}

function isList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

/** The written notes in a release body, or null when it has none (or they are malformed). */
export function readWrittenNotesBlock(body: string): WrittenNotes | null {
  const json = body.match(BLOCK)?.[1]
  if (!json) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: a malformed release body is logged
    console.warn('[release-notes] Unreadable written notes block', error)
    return null
  }
  const notes = parsed as WrittenNotes
  const valid = (['en', 'ro'] as const).every(
    (lang) => isList(notes?.[lang]?.features) && isList(notes[lang].bugFixes),
  )
  return valid ? notes : null
}
