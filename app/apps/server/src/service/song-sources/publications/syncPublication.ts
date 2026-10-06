import { getPublication } from './listPublications'
import { recordPublicationSync } from './upsertPublication'
import { createLogger } from '../../../utils/logger'
import { buildBundleFiles } from '../bundle/buildBundleFiles'
import { MANIFEST_FILE, type SongBundleManifest } from '../bundle/types'
import { getS3Storage } from '../storage/getS3Storage'
import { openBucket } from '../storage/openBucket'

const logger = createLogger('song-sources')

/** Uploads at a time; enough to publish thousands of songs quickly. */
const CONCURRENCY = 8

async function runLimited<T>(
  items: T[],
  task: (item: T) => Promise<unknown>,
): Promise<void> {
  const queue = [...items]
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await task(item)
    }
  })
  await Promise.all(workers)
}

/** The manifest without its timestamp, to tell whether anything changed. */
function contentKey(manifest: SongBundleManifest): string {
  return JSON.stringify({ ...manifest, updatedAt: '' })
}

export interface SyncResult {
  uploaded: number
  deleted: number
}

/**
 * Brings a publication's S3 folder in line with its category: uploads the
 * songs whose hash changed, deletes the ones that left, then writes the
 * manifest (last, so readers never see a song listed before it exists).
 * Nothing is sent when nothing changed.
 */
export async function syncPublication(id: number): Promise<SyncResult> {
  const publication = getPublication(id)
  if (!publication) throw new Error(`Publication ${id} not found`)
  const storage = getS3Storage()
  if (!storage) throw new Error('No S3 storage is configured')

  const bundle = buildBundleFiles(publication.categoryId, {
    name: publication.categoryName,
    categoryName: publication.categoryName,
  })
  const previous = publication.publishedManifest
  if (previous && contentKey(previous) === contentKey(bundle.manifest)) {
    return { uploaded: 0, deleted: 0 }
  }

  const previousHashes = new Map(
    (previous?.songs ?? []).map((song) => [song.path, song.hash]),
  )
  const changed = bundle.manifest.songs.filter(
    (song) => previousHashes.get(song.path) !== song.hash,
  )
  const currentPaths = new Set(bundle.manifest.songs.map((song) => song.path))
  const removed = [...previousHashes.keys()].filter(
    (path) => !currentPaths.has(path),
  )

  const bucket = openBucket(storage, publication.folder)
  try {
    await runLimited(changed, (song) =>
      bucket.write(song.path, bundle.songFiles.get(song.path) ?? ''),
    )
    const manifest = JSON.stringify(bundle.manifest)
    await bucket.write(MANIFEST_FILE, manifest)
    await runLimited(removed, (path) => bucket.delete(path))
    recordPublicationSync(id, { manifest })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    recordPublicationSync(id, { error: message })
    throw error
  }

  logger.info(
    `Published "${publication.categoryName}": ${changed.length} uploaded, ${removed.length} deleted`,
  )
  return { uploaded: changed.length, deleted: removed.length }
}
