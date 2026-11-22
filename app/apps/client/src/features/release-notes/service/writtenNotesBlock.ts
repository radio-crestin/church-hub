import type { WrittenNotes, WrittenNotesInLanguage } from '../types'

/**
 * The written notes of a version (written-notes.json, by the agent cutting
 * the release) travel to GitHub inside its CHANGELOG.md section, which the
 * release CI copies into the release body: readable in both languages, plus
 * the same notes as one HTML comment, invisible on the release page, which
 * the app reads back: `<!-- church-hub-notes {json} -->`.
 */
const BLOCK = /<!--\s*church-hub-notes\s+(\{[\s\S]*?\})\s*-->/

function isList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

/** Both languages, each with its features and fixes, as lists of sentences. */
export function isWrittenNotes(value: unknown): value is WrittenNotes {
  const notes = value as WrittenNotes
  return (['en', 'ro'] as const).every(
    (lang) => isList(notes?.[lang]?.features) && isList(notes[lang].bugFixes),
  )
}

function renderBlock(notes: WrittenNotes): string {
  // `--` can't appear inside an HTML comment: JSON escapes it.
  const json = JSON.stringify(notes).replace(/--/g, '-\\u002d')
  return `<!-- church-hub-notes ${json} -->`
}

function renderLanguage(
  heading: string,
  labels: [features: string, bugFixes: string],
  notes: WrittenNotesInLanguage,
): string[] {
  const lines = [`### ${heading}`, '']
  const lists: [string, string[]][] = [
    [labels[0], notes.features],
    [labels[1], notes.bugFixes],
  ]
  for (const [label, items] of lists) {
    if (!items.length) continue
    lines.push(`**${label}**`, '', ...items.map((item) => `- ${item}`), '')
  }
  return lines
}

/** A version's notes as markdown lines: English, Romanian, then the block the app reads. */
export function renderWrittenNotes(notes: WrittenNotes): string[] {
  return [
    ...renderLanguage("What's new", ['New', 'Fixed'], notes.en),
    ...renderLanguage('Ce e nou', ['Noutăți', 'Corectări'], notes.ro),
    renderBlock(notes),
    '',
  ]
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
  return isWrittenNotes(parsed) ? parsed : null
}
