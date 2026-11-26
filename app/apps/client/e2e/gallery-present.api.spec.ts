import { expect, test } from '@playwright/test'

import {
  BUILT_IN_VIDEO,
  deleteUploadedMedia,
  PNG,
  uploadMedia,
} from './helpers/background-media'

/**
 * POST /api/presentation/temporary-image and /temporary-video put a gallery
 * file full screen on the screens, by id: the server checks the file is in the
 * gallery and of that kind, and builds its URL itself.
 */

const MISSING_IMAGE = '00000000-0000-4000-8000-000000000000.png'

test.describe('Gallery present API', () => {
  test.afterEach(async ({ request }) => {
    await request.post('/api/presentation/clear-temporary')
    await deleteUploadedMedia(request)
  })

  test('presents an image, which Next leaves up and clear-temporary takes off', async ({
    request,
  }) => {
    const image = await uploadMedia(request, PNG, 'image/png', 'api.png')

    const res = await request.post('/api/presentation/temporary-image', {
      data: { mediaId: image.id },
    })
    expect(res.status()).toBe(200)
    expect((await res.json()).data).toMatchObject({
      isPresenting: true,
      isHidden: false,
      currentSongSlideId: null,
      temporaryContent: {
        type: 'image',
        data: { mediaId: image.id, url: `/api/media/backgrounds/${image.id}` },
        presentationBackground: null,
      },
    })

    const next = await request.post('/api/presentation/navigate-temporary', {
      data: { direction: 'next', requestTimestamp: Date.now() },
    })
    expect((await next.json()).data.temporaryContent).toMatchObject({
      type: 'image',
      data: { mediaId: image.id },
    })

    const cleared = await request.post('/api/presentation/clear-temporary')
    expect((await cleared.json()).data).toMatchObject({
      isHidden: true,
      temporaryContent: null,
    })
  })

  test('presents a video, once', async ({ request }) => {
    const res = await request.post('/api/presentation/temporary-video', {
      data: { mediaId: BUILT_IN_VIDEO.id },
    })
    expect(res.status()).toBe(200)
    const { temporaryContent } = (await res.json()).data
    expect(temporaryContent).toMatchObject({
      type: 'video',
      data: {
        mediaId: BUILT_IN_VIDEO.id,
        url: `/api/media/backgrounds/${BUILT_IN_VIDEO.id}`,
      },
    })
    expect(temporaryContent.data.loop).toBeUndefined()
    expect(temporaryContent.data.scheduleId).toBeUndefined()
  })

  test('refuses a bad id, the wrong kind and a missing file', async ({
    request,
  }) => {
    const image = await uploadMedia(request, PNG, 'image/png', 'kind.png')
    const before = (await (await request.get('/api/presentation/state')).json())
      .data.updatedAt

    const refusals: [string, unknown, number][] = [
      ['/api/presentation/temporary-image', undefined, 400],
      ['/api/presentation/temporary-image', '../secrets.png', 400],
      ['/api/presentation/temporary-image', BUILT_IN_VIDEO.id, 400],
      ['/api/presentation/temporary-video', image.id, 400],
      ['/api/presentation/temporary-image', MISSING_IMAGE, 404],
    ]
    for (const [path, mediaId, status] of refusals) {
      const res = await request.post(path, { data: { mediaId } })
      expect(res.status(), `${path} ${mediaId}`).toBe(status)
      expect((await res.json()).error).toEqual(expect.any(String))
    }

    // Nothing reached the screens.
    const after = (await (await request.get('/api/presentation/state')).json())
      .data.updatedAt
    expect(after).toBe(before)
  })

  test('both are in the OpenAPI spec', async ({ request }) => {
    const spec = await (await request.get('/api/openapi.json')).json()
    for (const path of [
      '/api/presentation/temporary-image',
      '/api/presentation/temporary-video',
    ]) {
      expect(spec.paths[path]?.post?.requestBody).toBeTruthy()
    }
    expect(spec.components.schemas.TemporaryImageContent).toBeTruthy()
  })
})
