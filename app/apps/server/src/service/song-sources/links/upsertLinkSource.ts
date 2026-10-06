import { readLinkManifest } from './readLinkManifest'
import { requireLinkUrl } from './requireLinkUrl'
import { getRawDatabase } from '../../../db'
import { listSongSources } from '../listSongSources'
import type { SongSource } from '../types'

/** Same link, same id: adding a link twice updates the one source. */
function linkSourceId(url: string): string {
  const hash = new Bun.CryptoHasher('sha256').update(url).digest('hex')
  return `link-${hash.slice(0, 12)}`
}

/**
 * Adds a source from someone's shared link (a `.chsongs` file or a folder's
 * manifest.json). Reads the link first, so a wrong link fails here, and
 * takes the source's name and category from its manifest.
 */
export async function upsertLinkSource(link: string): Promise<SongSource> {
  const url = requireLinkUrl(link).toString()
  const { manifest, format } = await readLinkManifest(url)
  const id = linkSourceId(url)

  getRawDatabase()
    .query(
      `INSERT INTO song_source_subscriptions (id, name, category_name, format, url)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name,
         category_name = excluded.category_name, format = excluded.format`,
    )
    .run(id, manifest.name, manifest.categoryName, format, url)

  const source = listSongSources().find((s) => s.id === id)
  if (!source) throw new Error('Could not save the song source')
  return source
}
