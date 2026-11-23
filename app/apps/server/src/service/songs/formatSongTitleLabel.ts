export interface SongTitleSource {
  title: string
  hymnNumber?: string | null
  sourceFilename?: string | null
  categoryName?: string | null
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
 * The song's title as the room reads it in the projector's corner: the
 * songbook's initials and the song's number before its title, as in
 * "PDC 19 · La masa Ta noi azi venim". The number is the one in the title
 * ("019 - La masa Ta…"), else the hymn number, else the one the source file
 * starts with ("030 - n-ai asemanare.pptx"); a song without one shows its
 * title alone.
 */
export function formatSongTitleLabel(song: SongTitleSource): string {
  const inTitle = song.title.match(LEADING_NUMBER)
  const title = (inTitle?.[2] || song.title).trim()
  const number =
    numberOf(inTitle?.[1]) ??
    numberOf(song.hymnNumber) ??
    numberOf(song.sourceFilename?.match(LEADING_NUMBER)?.[1])
  if (!number) return title
  const prefix = [initials(song.categoryName), number].filter(Boolean).join(' ')
  return `${prefix} · ${title}`
}
