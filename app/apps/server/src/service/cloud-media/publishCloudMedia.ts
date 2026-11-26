import { stat } from 'node:fs/promises'

import { publishesCloudVideos } from './cloudMediaVideos'
import { hashMediaFile } from './hashMediaFile'
import { listReferencedMedia } from './listReferencedMedia'
import { createLogger } from '../../utils/logger'
import { toErrorMessage } from '../../utils/toErrorMessage'
import { getBackgroundMediaTypeById } from '../background-media/getBackgroundMediaTypeById'
import { resolveBackgroundMediaPath } from '../background-media/resolveBackgroundMediaPath'
import { getCloudIdentity } from '../sync/cloud/cloudIdentityStore'
import {
  serviceError,
  syncServiceRequest,
} from '../sync/cloud/syncServiceRequest'

const logger = createLogger('cloud-media')

interface LocalMedia {
  id: string
  path: string
  size: number
  mtimeMs: number
  type: string
  isVideo: boolean
}

interface PublishItem {
  id: string
  hash: string
  size: number
  type: string
}

interface PublishAnswer {
  available: number
  uploads: { hash: string; url: string; headers: Record<string, string> }[]
  skipped: { id: string; reason: string }[]
}

/** What was published last (read path, files, choice): unchanged is skipped. */
let lastPublished = ''
let publishing: Promise<void> | null = null

/** The referenced files this PC has and publishes: images, then videos. */
async function localMedia(videos: boolean): Promise<LocalMedia[]> {
  const found: LocalMedia[] = []
  for (const id of listReferencedMedia()) {
    const { mimeType, kind } = getBackgroundMediaTypeById(id)
    if (kind === 'video' && !videos) continue
    const path = resolveBackgroundMediaPath(id)
    const info = await stat(path).catch(() => null)
    if (!info?.isFile()) continue
    found.push({
      id,
      path,
      size: info.size,
      mtimeMs: info.mtimeMs,
      type: mimeType,
      isVideo: kind === 'video',
    })
  }
  // The service keeps what fits its limits in this order.
  return found.sort(
    (a, b) => Number(a.isVideo) - Number(b.isVideo) || a.size - b.size,
  )
}

/**
 * Puts the media the church's synced data shows in its bucket, so a phone
 * finds it with this PC off (docs/design/cloud-sync-and-shared-library.md
 * §8): each file once, by its content, uploaded straight to the bucket, and
 * listed for readers once it is there. Runs after each cloud sync; does
 * nothing while the files, the read path and the choice are as last time.
 */
export function publishCloudMedia(): Promise<void> {
  publishing ??= publish().finally(() => {
    publishing = null
  })
  return publishing
}

async function publish(): Promise<void> {
  const identity = await getCloudIdentity()
  if (!identity) return
  try {
    const videos = publishesCloudVideos()
    const media = await localMedia(videos)
    const fingerprint = JSON.stringify([
      identity.readUrl,
      videos,
      media.map(({ id, size, mtimeMs }) => [id, size, mtimeMs]),
    ])
    if (fingerprint === lastPublished) return

    const items: PublishItem[] = []
    for (const file of media) {
      items.push({
        id: file.id,
        hash: await hashMediaFile(
          file.path,
          `${file.id}:${file.size}:${file.mtimeMs}`,
        ),
        size: file.size,
        type: file.type,
      })
    }
    const send = async () => {
      const response = await syncServiceRequest<PublishAnswer>(
        { serviceUrl: identity.serviceUrl, identity },
        'POST',
        '/media',
        { items },
      )
      if (response.status !== 200) throw serviceError(response)
      return response.body
    }

    const answer = await send()
    for (const upload of answer.uploads) {
      const item = items.find((candidate) => candidate.hash === upload.hash)
      const file = media.find((candidate) => candidate.id === item?.id)
      if (!file) continue
      const put = await fetch(upload.url, {
        method: 'PUT',
        headers: upload.headers,
        body: Bun.file(file.path),
      })
      if (!put.ok) throw new Error(`Media upload failed: ${put.status}`)
    }
    const final = answer.uploads.length > 0 ? await send() : answer
    for (const { id, reason } of final.skipped) {
      logger.warning(`Media ${id} not published for phones: ${reason}`)
    }
    logger.info(
      `Published ${final.available} media file(s) for phones (${answer.uploads.length} uploaded)`,
    )
    lastPublished = fingerprint
  } catch (error) {
    logger.error(`Publishing media for phones failed: ${toErrorMessage(error)}`)
  }
}
