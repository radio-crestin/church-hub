import { buildLibrary } from '@church-hub/song-formats'

import { libraryRequest } from './libraryRequest'
import { readShareSongs } from './readShareSongs'
import { requireCloudIdentity } from './requireCloudIdentity'
import { getShare, recordShareSync } from './shareStore'
import { createLogger } from '../../../utils/logger'

const logger = createLogger('song-sources:share')

/** Uploads at a time. */
const CONCURRENCY = 4

export interface PublishResult {
  uploaded: number
  songCount: number
}

/**
 * Publishes one of the church's shares: builds the library from its songs, uploads
 * only the shards the bucket lacks (each named by its content, so an
 * unchanged shard is never sent again), then the manifest, from the one
 * last published. The service is the only writer; when the manifest
 * changed there meanwhile (another PC of the church), it is replaced from
 * the current one. Nothing is sent when no song changed, unless `force`
 * (the user changed what is shared: its name, listing or songs).
 */
export async function publishShare(
  id: number,
  { force = false } = {},
): Promise<PublishResult> {
  const share = getShare(id)
  if (!share) throw new Error('Nothing is shared')
  const identity = await requireCloudIdentity()
  try {
    const { manifest, shards } = await buildLibrary(
      {
        sourceId: share.sourceId,
        name: share.name,
        categoryName: share.name,
        listed: share.listed,
        publisher: share.publisher,
      },
      readShareSongs(share),
    )
    if (
      !force &&
      share.manifestUrl &&
      share.publishedChecksum === manifest.checksum
    ) {
      return { uploaded: 0, songCount: manifest.songCount }
    }

    const sent = new Set(share.publishedShards)
    const fresh = manifest.shards.filter((shard) => !sent.has(shard.path))
    const queue = [...fresh]
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        for (let shard = queue.shift(); shard; shard = queue.shift()) {
          await libraryRequest(
            identity,
            'PUT',
            `${share.sourceId}/shards/${shard.hash}`,
            shards.get(shard.path),
          )
        }
      }),
    )

    const put = (baseChecksum: string | null) =>
      libraryRequest<{ checksum: string | null }>(
        identity,
        'PUT',
        `${share.sourceId}/manifest`,
        { baseChecksum, manifest },
        [409],
      )
    let answer = await put(share.manifestUrl ? share.publishedChecksum : null)
    if (answer.status === 409) answer = await put(answer.body.checksum ?? null)
    if (answer.status === 409) throw new Error('The library changed meanwhile')

    const { body } = await libraryRequest<{ manifestUrl: string }>(
      identity,
      'GET',
      share.sourceId,
    )
    recordShareSync(share.id, {
      manifestUrl: body.manifestUrl,
      checksum: manifest.checksum,
      shards: manifest.shards.map((shard) => shard.path),
      songCount: manifest.songCount,
    })
    logger.info(
      `Shared "${share.name}": ${manifest.songCount} songs, ${fresh.length} shards uploaded`,
    )
    return { uploaded: fresh.length, songCount: manifest.songCount }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    recordShareSync(share.id, { error: message })
    throw error
  }
}
