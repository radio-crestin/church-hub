import type { ChangeCategory, ChangeEntry, VersionNotes } from '../types'

// Headings emitted by app/scripts/generate-changelog.ts into the GitHub
// release body. Matched case-insensitively, emoji optional, so the parser
// stays robust if the exact rendering drifts slightly.
const HEADING_TO_CATEGORY: Array<{ re: RegExp; category: ChangeCategory }> = [
  { re: /features/i, category: 'features' },
  { re: /bug\s*fixes/i, category: 'bugFixes' },
  { re: /changes/i, category: 'changes' },
]

function categoryForHeading(text: string): ChangeCategory | null {
  for (const { re, category } of HEADING_TO_CATEGORY) {
    if (re.test(text)) return category
  }
  return null
}

function parseBullet(line: string): ChangeEntry | null {
  const bullet = line.replace(/^\s*[-*]\s+/, '').trim()
  if (!bullet) return null

  // "**scope**: message" -> { scope, message }
  const scoped = bullet.match(/^\*\*([^*]+)\*\*:\s*(.+)$/)
  if (scoped?.[1] && scoped[2]) {
    return { scope: scoped[1].trim(), message: scoped[2].trim() }
  }
  return { scope: null, message: bullet }
}

/**
 * Parses a GitHub release body (markdown produced by our changelog generator)
 * into structured, categorized notes. Lines outside our known headings — the
 * download tables, quick-start, etc. — are ignored.
 */
export function parseReleaseBody(
  version: string,
  date: string | null,
  body: string,
): VersionNotes {
  const notes: VersionNotes = {
    version: version.replace(/^v/, ''),
    date,
    features: [],
    bugFixes: [],
    changes: [],
  }

  let current: ChangeCategory | null = null
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim()
    const heading = line.match(/^#{1,6}\s+(.+)$/)
    if (heading) {
      current = categoryForHeading(heading[1])
      continue
    }
    if (current && /^\s*[-*]\s+/.test(line)) {
      const entry = parseBullet(line)
      if (entry) notes[current].push(entry)
    }
  }

  return notes
}
