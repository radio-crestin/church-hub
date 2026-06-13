import {
  downloadFromUrl,
  type ParsedSong,
  processZipFromBuffer,
  sanitizeSongTitle,
} from '~/features/song-import'
import type { SourceProvider } from './types'
import type { DiscoveryCandidate } from '../types'

const RESURSE_CRESTINE_URL =
  'https://download.resursecrestine.ro/programe-crestine/cantece-resurse-crestine-opensong-standard.zip'
const RESURSE_CRESTINE_CATEGORY_NAME = 'Resurse Crestine'

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
 * The Resurse Crestine source: a ZIP of OpenSong XML files downloaded from
 * resursecrestine.ro (proxied through the server for CORS). Reuses the exact
 * download + parse pipeline the one-shot importer uses; the only difference is
 * we hand back per-song candidates for review instead of importing in bulk.
 */
export const resurseCrestineProvider: SourceProvider = {
  id: 'resurse-crestine',
  labelKey: 'sources.resurseCrestine',
  catalogUrl: RESURSE_CRESTINE_URL,
  defaultCategoryName: RESURSE_CRESTINE_CATEGORY_NAME,

  async fetchCatalog(onProgress): Promise<DiscoveryCandidate[]> {
    onProgress?.({
      phase: 'downloading',
      current: 0,
      total: null,
      currentFile: RESURSE_CRESTINE_CATEGORY_NAME,
    })

    const zipData = await downloadFromUrl(
      RESURSE_CRESTINE_URL,
      (downloaded, total) => {
        onProgress?.({
          phase: 'downloading',
          current: downloaded,
          total,
          currentFile: RESURSE_CRESTINE_CATEGORY_NAME,
        })
      },
    )

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
          tempId: s.sourceFilename ?? `resurse-crestine-${index}`,
          parsed: title === parsed.title ? parsed : { ...parsed, title },
          sourceFilename: s.sourceFilename,
          sourceFormat: 'opensong' as const,
        }
      })
  },
}
