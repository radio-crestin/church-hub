import type { AlternateTitleEntry } from '~/features/songs/service'
import type { DiscoveryCandidate } from '../types'

/**
 * The names the external catalogue knows each of its songs by, keyed by the
 * file they came from.
 *
 * A library imported with "use the first verse as the title" is filed under
 * each song's opening line, and the name the source gave it was thrown away —
 * "Zece mii de motive" ends up stored as "E o nouă zi, soarele răsare". The
 * catalogue still carries the real name, and the source filename the import
 * recorded is the link back to it.
 *
 * Everything with both a filename and a title is sent: the server skips songs
 * that already carry the name, so deciding here what has changed would only
 * duplicate that with a staler picture of the library.
 */
export function alternateTitleEntries(
  candidates: DiscoveryCandidate[],
): AlternateTitleEntry[] {
  const entries: AlternateTitleEntry[] = []
  for (const candidate of candidates) {
    const sourceFilename = candidate.sourceFilename?.trim()
    const title = candidate.parsed.title?.trim()
    if (!sourceFilename || !title) continue
    entries.push({ sourceFilename, titles: [title] })
  }
  return entries
}
