import {
  downloadFromUrl,
  type ParsedSong,
  processZipFromBuffer,
  sanitizeSongTitle,
} from '~/features/song-import'
import type { FetchCatalog } from './types'

/** A title is "junk" when the OpenSong file had no <title> — the parser then
 * falls back to the filename, which for untitled entries is "[unnamed] - NNNN"
 * and sanitizes down to "unnamed" / "Untitled Song". */
function isJunkTitle(title: string): boolean {
  const t = title.trim().toLowerCase()
  return t === '' || t === 'unnamed' || t === 'untitled song'
}

/** Uses the first non-empty lyric line as the title when the parsed title is
 * junk — same idea as the one-shot importer's "use first verse as title". */
function deriveTitle(parsed: ParsedSong): string {
  if (!isJunkTitle(parsed.title)) return parsed.title
  for (const slide of parsed.slides) {
    const firstLine = slide.text
      ?.split('\n')
      .map((line) => line.trim())
      .find(Boolean)
    if (firstLine) {
      const derived = sanitizeSongTitle(firstLine)
      if (!isJunkTitle(derived)) return derived
    }
  }
  return parsed.title
}

/**
 * A ZIP of OpenSong XML files (Resurse Creștine), downloaded through the
 * server proxy for CORS. Reuses the one-shot importer's download + parse
 * pipeline, but hands back per-song candidates for review.
 */
export const fetchOpenSongZipCatalog: FetchCatalog = async (
  source,
  onProgress,
) => {
  onProgress?.({
    phase: 'downloading',
    current: 0,
    total: null,
    currentFile: source.name,
  })

  const zipData = await downloadFromUrl(source.url, (downloaded, total) => {
    onProgress?.({
      phase: 'downloading',
      current: downloaded,
      total,
      currentFile: source.name,
    })
  })

  const result = await processZipFromBuffer(zipData, onProgress)

  // Only OpenSong files carry the structured metadata (author, hymn number,
  // key line) the discovery flow surfaces; PPTX entries in this archive are
  // ignored here to keep candidates uniform.
  return result.songs
    .filter((s) => s.sourceFormat === 'opensong')
    .map((s, index) => {
      const parsed = s.parsed as ParsedSong
      // Replace a missing/"unnamed" title with the first lyric line so the
      // review list reads sensibly and dedup doesn't collapse every untitled
      // song onto the same "unnamed" title.
      const title = deriveTitle(parsed)
      return {
        tempId: s.sourceFilename ?? `${source.id}-${index}`,
        parsed: title === parsed.title ? parsed : { ...parsed, title },
        sourceFilename: s.sourceFilename,
      }
    })
}
