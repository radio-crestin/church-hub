import { type APIRequestContext, expect, test } from '@playwright/test'

import { FakeS3 } from './helpers/fake-s3'
import {
  addLinkSource,
  checkSource,
  clearNotifications,
  deleteCategoriesNamed,
  openSongXml,
  publishSongFolder,
  setAutoUpdate,
} from './helpers/song-folder-source'

/**
 * Removing a song source also removes its songs from the "waiting for your
 * approval" notification: nothing is left to approve from a source that is
 * gone, so no pop-up keeps announcing it.
 */

// Letters only: titles lose their digits on the way in.
const tag = String(Date.now()).replace(/\d/g, (d) => 'abcdefghij'[Number(d)])
const categoryName = `E2E Sursa stearsa ${tag}`

async function pendingNotifications(request: APIRequestContext) {
  const res = await request.get('/api/notifications')
  return ((await res.json()).data as { kind: string }[]).filter(
    (n) => n.kind === 'songs-pending',
  )
}

test('deleting a source drops its songs waiting for approval', async ({
  request,
}) => {
  const s3 = new FakeS3()
  await s3.start()
  await clearNotifications(request)
  let sourceId = ''
  try {
    const url = publishSongFolder(
      s3,
      `/delete-pending/${tag}`,
      categoryName,
      [
        {
          id: 'a',
          title: `Cantare de aprobat ${tag}`,
          xml: openSongXml(`Cantare de aprobat ${tag}`, [
            `${tag} pasii nostri spre lumina`,
          ]),
        },
      ],
      'one',
    )
    await setAutoUpdate(request, false)
    sourceId = await addLinkSource(request, url)
    await checkSource(request, sourceId)
    await expect
      .poll(async () => (await pendingNotifications(request)).length)
      .toBe(1)

    await request.delete(`/api/song-sources/${sourceId}`)
    sourceId = ''

    expect(await pendingNotifications(request)).toHaveLength(0)
  } finally {
    if (sourceId) await request.delete(`/api/song-sources/${sourceId}`)
    await setAutoUpdate(request, true)
    await deleteCategoriesNamed(request, [categoryName])
    await clearNotifications(request)
    await s3.stop()
  }
})
