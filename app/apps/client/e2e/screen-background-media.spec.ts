import fs from 'node:fs'
import { expect, type Page, test } from '@playwright/test'

import {
  backgroundImageStyle,
  backgroundTypeLabel,
  chooseBackgroundType,
  deleteMediaExcept,
  HEAVY_GIF,
  heavyGifDetails,
  JPEG_FIXTURE,
  label,
  listMediaIds,
  MEDIA_API,
  message,
  PNG,
  recordUploads,
  setScreenSongBackground,
  uploadMedia,
  uploadThroughPicker,
  WEBM_FIXTURE,
} from './helpers/background-media'

/**
 * Screen backgrounds can be an uploaded image or video: the server stores and
 * serves the file (with Range support), the screen editor uploads / picks /
 * deletes it, and the projection draws it in a layer BELOW the lyrics — a
 * video keeps playing (same element) while the slides change.
 */

const ROOT = '[data-testid="screen-renderer-root"]'
const SONG_KEY = 'Do Major'

/** A line of lyrics on the projection (not its hidden measuring copy). */
function lyric(page: Page, text: string) {
  return page
    .locator(ROOT)
    .getByText(text, { exact: true })
    .and(page.locator(':not([aria-hidden="true"])'))
}

/** Opens the full-screen editor of one screen from Settings → Screens. */
async function openScreenEditor(page: Page, screenId: number) {
  await page.goto('/settings/screens')
  const card = page.locator(
    `[data-testid="screen-card"][data-screen-id="${screenId}"]`,
  )
  await card
    .getByRole('button', {
      name: label('settings', 'sections.screens.actions.edit'),
    })
    .click()
  await expect(page.getByTestId('screen-editor-save')).toBeVisible({
    timeout: 10000,
  })

  // Song layout, with no element selected so the sidebar shows the screen's
  // own settings (Background among them).
  await page.getByTestId('screen-editor-content-type').click()
  const song = label('presentation', 'screens.contentTypes.song')
  await page
    .getByTestId('screen-editor-content-type-option')
    .filter({ hasText: song })
    .locator('button')
    .first()
    .click()
  await expect(page.getByTestId('screen-editor-content-type')).toHaveText(song)
  await expect(page.getByTestId('background-song-types-hint')).toBeVisible()
}

/** Frames the <video> has presented so far — grows across loops. */
function presentedFrames(page: Page): Promise<number> {
  return page
    .locator(`${ROOT} [data-testid="screen-background-video"]`)
    .evaluate(
      (el) =>
        (el as HTMLVideoElement).getVideoPlaybackQuality().totalVideoFrames,
    )
}

/**
 * DOM mutations inside the projection's background layer over `ms` — none
 * while nothing changes: the renderer re-renders every second (clock tick,
 * socket traffic), and any of that reaching the layer would restart a GIF or
 * reload the video.
 */
function backgroundLayerMutations(page: Page, ms: number): Promise<number> {
  return page.locator(`${ROOT} [data-testid="screen-background"]`).evaluate(
    (layer, duration) =>
      new Promise<number>((resolve) => {
        let count = 0
        const observer = new MutationObserver((records) => {
          count += records.length
        })
        observer.observe(layer, {
          subtree: true,
          childList: true,
          attributes: true,
        })
        setTimeout(() => {
          observer.disconnect()
          resolve(count)
        }, duration)
      }),
    ms,
  )
}

/** Whether a canvas shows something other than black (same-origin only). */
function canvasHasPicture(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext('2d')
  if (!context || canvas.width === 0) return false
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] + data[i + 1] + data[i + 2] > 60) return true
  }
  return false
}

test.describe('Screen background media', () => {
  let screenId: number
  let songId: number
  // Uploads that existed before this file ran; everything else is removed
  // afterwards, including an upload whose test failed before noting its id.
  let preexistingMediaIds = new Set<string>()
  const suffix = Date.now()
  const lyrics = [
    `Background verse one ${suffix}`,
    `Background verse two ${suffix}`,
    `Background verse three ${suffix}`,
  ]

  test.beforeAll(async ({ request }) => {
    preexistingMediaIds = new Set(await listMediaIds(request))

    const screenRes = await request.post('/api/screens', {
      data: { name: `E2E Background Media ${suffix}`, type: 'primary' },
    })
    expect([200, 201]).toContain(screenRes.status())
    screenId = (await screenRes.json()).data.id

    // The key makes slide 1 use "Song (first slide)" and slide 2 plain "Song",
    // so moving between them also switches the content config.
    const songRes = await request.post('/api/songs', {
      data: {
        title: `E2E Background Media ${suffix}`,
        keyLine: SONG_KEY,
        slides: lyrics.map((content, sortOrder) => ({ content, sortOrder })),
      },
    })
    expect(songRes.status()).toBe(201)
    songId = (await songRes.json()).data.id
  })

  test.afterEach(async ({ request }) => {
    await request.post('/api/presentation/stop')
  })

  test.afterAll(async ({ request }) => {
    await request.post('/api/presentation/stop')
    await deleteMediaExcept(request, preexistingMediaIds)
    if (screenId) await request.delete(`/api/screens/${screenId}`)
    if (songId) await request.delete(`/api/songs/${songId}`)
  })

  test('API stores, lists, serves (with ranges) and deletes an upload', async ({
    request,
  }) => {
    const media = await uploadMedia(request, PNG, 'image/png', 'e2e bg.png')

    expect(media.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/,
    )
    expect(media).toMatchObject({
      kind: 'image',
      mimeType: 'image/png',
      size: PNG.length,
      url: `${MEDIA_API}/${media.id}`,
    })
    expect(typeof media.createdAt).toBe('number')

    // Newest first.
    expect((await listMediaIds(request))[0]).toBe(media.id)

    const full = await request.get(media.url)
    expect(full.status()).toBe(200)
    expect(full.headers()['content-type']).toBe('image/png')
    expect(full.headers()['accept-ranges']).toBe('bytes')
    expect(Buffer.compare(await full.body(), PNG)).toBe(0)

    const head = await request.head(media.url)
    expect(head.status()).toBe(200)
    expect(head.headers()['content-length']).toBe(String(PNG.length))

    const partial = await request.get(media.url, {
      headers: { Range: 'bytes=0-9' },
    })
    expect(partial.status()).toBe(206)
    expect(partial.headers()['content-range']).toBe(`bytes 0-9/${PNG.length}`)
    const partialBody = await partial.body()
    expect(partialBody.length).toBe(10)
    expect(Buffer.compare(partialBody, PNG.subarray(0, 10))).toBe(0)

    const unsatisfiable = await request.get(media.url, {
      headers: { Range: `bytes=${PNG.length + 10}-` },
    })
    expect(unsatisfiable.status()).toBe(416)
    expect(unsatisfiable.headers()['content-range']).toBe(
      `bytes */${PNG.length}`,
    )

    const unsupported = await request.post(`${MEDIA_API}?name=notes.txt`, {
      headers: { 'Content-Type': 'text/plain' },
      data: Buffer.from('not an image'),
    })
    expect(unsupported.status()).toBe(415)

    // Ids are validated before touching the disk: no traversal, no guessing.
    for (const badId of ['..%2F..%2Fapp.db', '..%2Fapp.db', 'not-a-uuid.png']) {
      const res = await request.get(`${MEDIA_API}/${badId}`)
      expect([400, 404]).toContain(res.status())
      expect((await res.body()).toString('latin1')).not.toContain(
        'SQLite format',
      )
    }
    expect(
      (
        await request.get(
          `${MEDIA_API}/00000000-0000-4000-8000-000000000000.png`,
        )
      ).status(),
    ).toBe(404)

    const deleted = await request.delete(media.url)
    expect(deleted.status()).toBe(200)
    expect((await deleted.json()).data).toEqual({ success: true })

    expect((await request.get(media.url)).status()).toBe(404)
    expect(await listMediaIds(request)).not.toContain(media.id)
  })

  test('the editor uploads an image, selects it and saves it with its opacity', async ({
    page,
    request,
  }) => {
    await openScreenEditor(page, screenId)
    await chooseBackgroundType(page, 'image')

    // The new upload is selected right away and drawn on the canvas.
    const media = await uploadThroughPicker(page, request, {
      name: 'e2e-editor-background.png',
      mimeType: 'image/png',
      buffer: PNG,
    })
    expect(media).toMatchObject({ kind: 'image', size: PNG.length })
    const canvasImage = page.getByTestId('screen-background-image')
    await expect(canvasImage).toHaveCount(1)
    await expect(canvasImage).toHaveAttribute(
      'style',
      backgroundImageStyle(media.url),
    )

    // 100% → 70% with the keyboard, as a user would.
    const opacity = page.getByTestId('background-opacity')
    await opacity.focus()
    for (let i = 0; i < 30; i++) await opacity.press('ArrowLeft')
    await expect(opacity).toHaveValue('70')
    await expect(canvasImage).toHaveCSS('opacity', '0.7')

    const saveResponse = page.waitForResponse(
      (res) =>
        res.url().endsWith(`/api/screens/${screenId}/batch-config`) &&
        res.request().method() === 'PUT',
    )
    await page.getByTestId('screen-editor-save').click()
    expect((await saveResponse).ok()).toBeTruthy()
    await expect(page.getByTestId('screen-editor-save')).toBeDisabled()

    const { data: screen } = await (
      await request.get(`/api/screens/${screenId}`)
    ).json()
    const background = screen.contentConfigs.song.background
    expect(background.type).toBe('image')
    expect(background.imageUrl).toBe(`${MEDIA_API}/${media.id}`)
    expect(background.imageUrl.startsWith(`${MEDIA_API}/`)).toBe(true)
    expect(background.opacity).toBe(0.7)
  })

  test('the projection draws an image background under the lyrics', async ({
    page,
    request,
  }) => {
    const media = await uploadMedia(request, PNG, 'image/png', 'display.png')
    await setScreenSongBackground(request, screenId, {
      type: 'image',
      imageUrl: media.url,
      color: '#000000',
      opacity: 0.5,
    })

    const present = await request.post('/api/presentation/temporary-song', {
      data: { songId, slideIndex: 0 },
    })
    expect(present.ok()).toBeTruthy()

    await page.goto(`/screen/${screenId}`)
    const root = page.locator(ROOT)
    const background = root.getByTestId('screen-background')
    await expect(background).toHaveAttribute('data-background-type', 'image')
    const image = background.getByTestId('screen-background-image')
    await expect(image).toHaveAttribute(
      'style',
      backgroundImageStyle(media.url),
    )
    await expect(image).toHaveCSS('opacity', '0.5')

    const verse = lyric(page, lyrics[0])
    await expect(verse).toBeVisible({ timeout: 10000 })
    // The boot overlay fades out over the page before it is removed.
    await expect(page.locator('#loading-screen')).toHaveCount(0)

    // Opacity dims the background only — never the lyrics above it.
    await expect(root).toHaveCSS('opacity', '1')

    // Paint order: with hit-testing turned on for every element (the
    // background layer is pointer-events: none), the topmost element at the
    // centre of the lyrics must be the lyrics, not the background.
    await page.addStyleTag({
      content: `${ROOT}, ${ROOT} * { pointer-events: auto !important; }`,
    })
    const box = await verse.boundingBox()
    expect(box).not.toBeNull()
    const hit = await verse.evaluate(
      (text, point) => {
        const topmost = document.elementFromPoint(point.x, point.y)
        return {
          inBackground: !!topmost?.closest('[data-testid="screen-background"]'),
          onText:
            !!topmost && (text.contains(topmost) || topmost.contains(text)),
        }
      },
      {
        x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
        y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
      },
    )
    expect(hit).toEqual({ inBackground: false, onText: true })
  })

  test('a video background plays and keeps playing across slides', async ({
    page,
    request,
  }) => {
    const media = await uploadMedia(
      request,
      fs.readFileSync(WEBM_FIXTURE),
      'video/webm',
      'background-loop.webm',
    )
    expect(media.kind).toBe('video')
    await setScreenSongBackground(request, screenId, {
      type: 'video',
      videoUrl: media.url,
      color: '#000000',
      opacity: 1,
    })

    const present = await request.post('/api/presentation/temporary-song', {
      data: { songId, slideIndex: 0 },
    })
    expect(present.ok()).toBeTruthy()

    await page.goto(`/screen/${screenId}`)
    const root = page.locator(ROOT)
    await expect(lyric(page, lyrics[0])).toBeVisible({
      timeout: 10000,
    })
    // The key is only drawn by the "Song (first slide)" layout.
    await expect(lyric(page, SONG_KEY)).toBeVisible()
    await expect(root.getByTestId('screen-background')).toHaveAttribute(
      'data-background-type',
      'video',
    )
    const video = root.getByTestId('screen-background-video')
    await expect(video).toHaveCount(1)

    const props = await video.evaluate((el) => {
      const v = el as HTMLVideoElement
      return {
        loop: v.loop,
        muted: v.muted,
        autoplay: v.autoplay,
        src: v.src,
      }
    })
    expect(props).toEqual({
      loop: true,
      muted: true,
      autoplay: true,
      src: new URL(media.url, page.url()).href,
    })

    // It really decodes and plays.
    await expect
      .poll(() => video.evaluate((el) => (el as HTMLVideoElement).readyState), {
        timeout: 10000,
      })
      .toBeGreaterThanOrEqual(2)
    const framesBefore = await presentedFrames(page)
    await expect
      .poll(() => presentedFrames(page), { timeout: 10000 })
      .toBeGreaterThan(framesBefore + 5)

    // Left alone for a few clock ticks, nothing touches the playing video.
    expect(await backgroundLayerMutations(page, 2500)).toBe(0)

    // Tag the element, change slide (first-slide layout → song layout, both
    // with the same video) and check the very same element is still playing.
    await video.evaluate((el) => {
      ;(window as unknown as { __e2eBgVideo: Element }).__e2eBgVideo = el
    })
    const next = await request.post('/api/presentation/navigate-temporary', {
      data: { direction: 'next', requestTimestamp: Date.now() },
    })
    expect(next.ok()).toBeTruthy()
    expect(
      (await next.json()).data.temporaryContent.data.currentSlideIndex,
    ).toBe(1)
    await expect(lyric(page, lyrics[1])).toBeVisible({
      timeout: 10000,
    })
    await expect(lyric(page, lyrics[0])).toHaveCount(0)
    await expect(lyric(page, SONG_KEY)).toHaveCount(0)

    const framesAfterNavigation = await presentedFrames(page)
    await expect
      .poll(() => presentedFrames(page), { timeout: 10000 })
      .toBeGreaterThan(framesAfterNavigation + 5)
    const state = await video.evaluate((el) => ({
      sameElement:
        el === (window as unknown as { __e2eBgVideo: Element }).__e2eBgVideo,
      paused: (el as HTMLVideoElement).paused,
    }))
    expect(state).toEqual({ sameElement: true, paused: false })
  })

  test('slide thumbnails share one still of a video instead of a player each', async ({
    page,
    request,
  }) => {
    const media = await uploadMedia(
      request,
      fs.readFileSync(WEBM_FIXTURE),
      'video/webm',
      'thumbnail-still.webm',
    )
    const { data: song } = await (
      await request.get(`/api/songs/${songId}`)
    ).json()
    const background = {
      type: 'video',
      videoUrl: media.url,
      color: '#000000',
      opacity: 1,
    }
    const saved = await request.post('/api/songs', {
      data: { id: songId, title: song.title, background },
    })
    expect(saved.status()).toBe(200)

    try {
      await page.addInitScript(() => {
        window.localStorage.setItem('song-editor-layout', 'powerpoint')
      })
      await page.goto(`/songs/${songId}`)
      const thumbnails = page.getByTestId('stage-thumbnail')
      await expect(thumbnails).toHaveCount(lyrics.length, { timeout: 15000 })

      // Every <video> is a whole media player (download, decoder, buffers):
      // the filmstrip must not start one per slide just to show a frame.
      await expect(thumbnails.locator('video')).toHaveCount(0)
      const stills = thumbnails.getByTestId('screen-background-video-still')
      await expect(stills).toHaveCount(lyrics.length)
      for (let i = 0; i < lyrics.length; i++) {
        await expect(stills.nth(i)).toHaveAttribute('data-ready', 'true', {
          timeout: 10000,
        })
        expect(await stills.nth(i).evaluate(canvasHasPicture)).toBe(true)
      }
    } finally {
      await request.post('/api/songs', {
        data: { id: songId, title: song.title, background: null },
      })
    }
  })

  test('the editor uploads a video and deletes it through the confirm dialog', async ({
    page,
    request,
  }) => {
    await openScreenEditor(page, screenId)
    await chooseBackgroundType(page, 'video')

    const media = await uploadThroughPicker(page, request, WEBM_FIXTURE)
    expect(media).toMatchObject({ kind: 'video', mimeType: 'video/webm' })

    const tile = page.locator(
      `[data-testid="background-media-item"][data-media-id="${media.id}"]`,
    )
    await expect(page.getByTestId('screen-background-video')).toHaveAttribute(
      'src',
      new RegExp(`${media.url}$`),
    )

    await tile.getByTestId('background-media-delete').click()
    const dialog = page.locator('dialog[open]')
    await expect(dialog.getByRole('heading')).toHaveText(
      label('presentation', 'screens.background.deleteConfirmTitle'),
    )
    const deleteResponse = page.waitForResponse(
      (res) =>
        res.url().endsWith(`${MEDIA_API}/${media.id}`) &&
        res.request().method() === 'DELETE',
    )
    await dialog
      .getByRole('button', {
        name: label('presentation', 'screens.background.delete'),
      })
      .click()
    expect((await deleteResponse).status()).toBe(200)

    await expect(tile).toHaveCount(0)
    await expect(dialog).toHaveCount(0)
    // The screen no longer points at the deleted file.
    await expect(page.getByTestId('screen-background-video')).toHaveCount(0)
    expect(await listMediaIds(request)).not.toContain(media.id)
  })

  test('an upload of the other kind switches the background type to it', async ({
    page,
    request,
  }) => {
    await openScreenEditor(page, screenId)
    const typeSelect = page.getByTestId('background-type-select')
    const tile = (id: string) =>
      page.locator(
        `[data-testid="background-media-item"][data-media-id="${id}"]`,
      )

    // A JPG picked while choosing a video: the type follows the file.
    await chooseBackgroundType(page, 'video')
    const image = await uploadThroughPicker(page, request, JPEG_FIXTURE)
    expect(image).toMatchObject({ kind: 'image', mimeType: 'image/jpeg' })
    await expect(typeSelect).toHaveText(
      label('presentation', 'screens.background.types.image'),
    )
    await expect(tile(image.id)).toHaveAttribute('data-selected', 'true')
    await expect(
      page.getByText(
        message('presentation', 'screens.background.switchedType', (lng) => ({
          type: backgroundTypeLabel('image', lng),
        })),
      ),
    ).toBeVisible()
    await expect(page.getByTestId('screen-background-image')).toHaveAttribute(
      'style',
      backgroundImageStyle(image.url),
    )

    // And a WebM picked while choosing an image switches it back to Video.
    const video = await uploadThroughPicker(page, request, WEBM_FIXTURE)
    expect(video).toMatchObject({ kind: 'video', mimeType: 'video/webm' })
    await expect(typeSelect).toHaveText(
      label('presentation', 'screens.background.types.video'),
    )
    await expect(tile(video.id)).toHaveAttribute('data-selected', 'true')
    await expect(tile(image.id)).toHaveCount(0)
    await expect(
      page.getByText(
        message('presentation', 'screens.background.switchedType', (lng) => ({
          type: backgroundTypeLabel('video', lng),
        })),
      ),
    ).toBeVisible()
    await expect(page.getByTestId('screen-background-video')).toHaveAttribute(
      'src',
      new RegExp(`${video.url}$`),
    )
    await expect(page.getByTestId('screen-background-image')).toHaveCount(0)
  })

  test('the editor warns before uploading a heavy animated GIF, and Cancel keeps the background', async ({
    page,
    request,
  }) => {
    const media = await uploadMedia(request, PNG, 'image/png', 'kept.png')
    await setScreenSongBackground(request, screenId, {
      type: 'image',
      imageUrl: media.url,
      color: '#000000',
      opacity: 1,
    })
    await openScreenEditor(page, screenId)
    const canvasImage = page.getByTestId('screen-background-image')
    const tile = page.locator(
      `[data-testid="background-media-item"][data-media-id="${media.id}"]`,
    )
    await expect(canvasImage).toHaveAttribute(
      'style',
      backgroundImageStyle(media.url),
    )
    await expect(tile).toHaveAttribute('data-selected', 'true')
    const before = await listMediaIds(request)
    const uploads = recordUploads(page)

    await page.getByTestId('background-media-upload-input').setInputFiles({
      name: 'e2e-heavy-background.gif',
      mimeType: 'image/gif',
      buffer: HEAVY_GIF,
    })
    const warning = page.getByTestId('heavy-gif-warning')
    await expect(warning).toBeVisible()
    const items = warning.getByTestId('heavy-gif-warning-item')
    await expect(items).toHaveCount(1)
    await expect(items.first()).toContainText('e2e-heavy-background.gif')
    await expect(
      items.first().getByText(heavyGifDetails(HEAVY_GIF, 15)),
    ).toBeVisible()

    await warning
      .getByRole('button', { name: label('common', 'buttons.cancel') })
      .click()
    await expect(warning).toBeHidden()

    // Nothing was sent and the background still shows the same image.
    await expect(
      page.getByTestId('background-media-upload-button'),
    ).toBeEnabled()
    expect(await listMediaIds(request)).toEqual(before)
    expect(uploads).toEqual([])
    await expect(tile).toHaveAttribute('data-selected', 'true')
    await expect(
      page.locator(
        '[data-testid="background-media-item"][data-selected="true"]',
      ),
    ).toHaveCount(1)
    await expect(canvasImage).toHaveAttribute(
      'style',
      backgroundImageStyle(media.url),
    )
    await expect(page.getByTestId('screen-editor-save')).toBeDisabled()
  })
})
