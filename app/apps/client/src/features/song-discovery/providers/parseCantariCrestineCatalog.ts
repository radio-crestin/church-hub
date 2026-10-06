import type { ParsedSlideWithLabel } from '~/features/song-import'
import type { DiscoveryCandidate } from '../types'

/** One song as cantaricrestine.ro's API returns it. */
interface CantariCrestineSong {
  id: string
  /** Title, often prefixed by its hymnal number: "013 Marire Tie Isuse". */
  denumire: string
  /** Lyrics as plain text, stanzas separated by blank lines. */
  descriere: string | null
  /** The song's PowerPoint file: ".../cantari/ld/013 Marire Tie Isuse.ppt". */
  url_fisier: string | null
}

export interface CantariCrestineResponse {
  rezultate: Record<string, CantariCrestineSong> | CantariCrestineSong[]
}

const NUMBERED_TITLE = /^(\d{1,4})\s*[-.]?\s+(.+)$/

/** A stanza that only says "repeat the chorus here", with no lyrics of its own. */
const CHORUS_PLACEHOLDER = /^refren:?$/i

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** "013 Marire Tie Isuse" → title "013 - Marire Tie Isuse", hymn number "13",
 * the shape the library's numbered hymnals already use. */
function splitNumberedTitle(raw: string): {
  title: string
  hymnNumber: string | null
} {
  const trimmed = raw.trim()
  const match = trimmed.match(NUMBERED_TITLE)
  if (!match) return { title: trimmed, hymnNumber: null }
  return {
    title: `${match[1]} - ${match[2]}`,
    hymnNumber: String(Number(match[1])),
  }
}

function toSlides(lyrics: string): ParsedSlideWithLabel[] {
  const stanzas = lyrics
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((stanza) =>
      stanza
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter(
      (lines) =>
        lines.length > 0 &&
        !(lines.length === 1 && CHORUS_PLACEHOLDER.test(lines[0])),
    )

  return stanzas.map((lines, index) => ({
    slideNumber: index + 1,
    text: lines.join('\n'),
    htmlContent: lines.map((line) => `<p>${escapeHtml(line)}</p>`).join(''),
    label: `V${index + 1}`,
  }))
}

function fileName(url: string | null): string | null {
  if (!url) return null
  const name = decodeURIComponent(url.split('/').pop() ?? '').trim()
  return name || null
}

/**
 * Turns a cantaricrestine.ro API response into discovery candidates.
 * Songs without lyrics are left out: there is nothing to project.
 */
export function parseCantariCrestineCatalog(
  sourceId: string,
  response: CantariCrestineResponse,
): DiscoveryCandidate[] {
  const songs = Object.values(response.rezultate ?? {})
  const candidates: DiscoveryCandidate[] = []

  for (const song of songs) {
    const slides = toSlides(song.descriere ?? '')
    if (slides.length === 0) continue
    const { title, hymnNumber } = splitNumberedTitle(song.denumire)
    candidates.push({
      tempId: `${sourceId}-${song.id}`,
      parsed: {
        title,
        slides,
        metadata: {
          author: null,
          copyright: null,
          ccli: null,
          tempo: null,
          timeSignature: null,
          theme: null,
          altTheme: null,
          hymnNumber,
          keyLine: null,
          presentationOrder: null,
          churchHubId: null,
        },
      },
      sourceFilename: fileName(song.url_fisier),
    })
  }

  return candidates
}
