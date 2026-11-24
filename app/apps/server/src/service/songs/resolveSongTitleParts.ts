export interface SongTitleSource {
  title: string
  hymnNumber?: string | null
  sourceFilename?: string | null
  categoryName?: string | null
}

export interface SongTitleParts {
  /** The title without a leading number: "La masa Ta noi azi venim". */
  title: string
  /** The songbook's initials and the song's number: "PDC 19". */
  number?: string
}

/** "019 - La masa Ta" → number "019", rest "La masa Ta". */
const LEADING_NUMBER = /^\s*(\d{1,4})\s*[-–—.)]\s*(.*)$/

function initials(name: string | null | undefined): string | undefined {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return undefined
  return words.map((word) => word.charAt(0).toLocaleUpperCase('ro')).join('')
}

function numberOf(value: string | null | undefined): string | undefined {
  const digits = value?.match(LEADING_NUMBER)?.[1] ?? value?.trim()
  return digits && /^\d+$/.test(digits) ? String(Number(digits)) : undefined
}

/**
 * The song's title as the projector's corner shows it, in two parts: the title
 * without its leading number, and the songbook's initials with the song's
 * number ("PDC 19"), which a screen may show before it. The number is the one
 * in the title ("019 - La masa Ta…"), else the hymn number, else the one the
 * source file starts with ("030 - n-ai asemanare.pptx").
 */
export function resolveSongTitleParts(song: SongTitleSource): SongTitleParts {
  const inTitle = song.title.match(LEADING_NUMBER)
  const title = (inTitle?.[2] || song.title).trim()
  const number =
    numberOf(inTitle?.[1]) ??
    numberOf(song.hymnNumber) ??
    numberOf(song.sourceFilename?.match(LEADING_NUMBER)?.[1])
  if (!number) return { title }
  return {
    title,
    number: [initials(song.categoryName), number].filter(Boolean).join(' '),
  }
}
