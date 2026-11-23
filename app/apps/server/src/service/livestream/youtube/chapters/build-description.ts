import { type ChapterEntry, MIN_CHAPTER_MS } from './add-presented-item'

/** YouTube's limit for a description, in UTF-8 bytes. */
export const MAX_DESCRIPTION_BYTES = 5000

const SEPARATOR = '———'

function bytes(text: string): number {
  return Buffer.byteLength(text, 'utf8')
}

/** 0:00, 12:05 or 1:02:05, as YouTube reads chapter times. */
export function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/**
 * The broadcast's description with its chapters and the full text of each
 * song and verse: `base`, then one line per chapter (the stream's title at
 * 0:00 when nothing was shown yet), then the texts, as many as fit in
 * YouTube's 5000 bytes. The entry still on screen counts once it has lasted
 * MIN_CHAPTER_MS.
 */
export function buildDescription(
  base: string,
  streamTitle: string,
  log: ChapterEntry[],
  startedAt: number,
  now: number,
): string {
  const last = log.at(-1)
  const entries =
    last && now - last.at < MIN_CHAPTER_MS ? log.slice(0, -1) : log
  const [first] = entries
  if (!first) return base

  const chapters = entries.map((entry, i) => {
    // The first chapter starts at 0:00, or YouTube shows no chapters.
    const offset =
      entry.at - startedAt < MIN_CHAPTER_MS && i === 0
        ? 0
        : entry.at - startedAt
    return `${formatTimestamp(offset)} ${entry.title}`
  })
  if (first.at - startedAt >= MIN_CHAPTER_MS) {
    chapters.unshift(`0:00 ${streamTitle.replace(/[<>]/g, '')}`)
  }

  let description = [base.trim(), chapters.join('\n')]
    .filter(Boolean)
    .join('\n\n')
  if (bytes(description) > MAX_DESCRIPTION_BYTES) return base

  const texts = entries.map((entry) => `${entry.title}\n${entry.text}`)
  let separated = false
  for (const text of texts) {
    const next = `${description}\n\n${separated ? '' : `${SEPARATOR}\n\n`}${text}`
    if (bytes(next) > MAX_DESCRIPTION_BYTES) break
    description = next
    separated = true
  }
  return description
}
