import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import {
  backgroundImageStyle,
  chooseBackgroundType,
  deleteMediaExcept,
  label,
  listMediaIds,
  MEDIA_API,
  PNG,
  setScreenSongBackground,
  uploadMedia,
  uploadThroughPicker,
} from './helpers/background-media'

/**
 * A song can carry its own background (edited in the song editor). While one
 * of its slides is live it replaces the song background of audience (primary)
 * and kiosk screens — stage monitors and the live stream keep theirs — and an
 * edit reaches the projection without presenting the song again. The song
 * page can hide it in its previews only ("Background" toggle, remembered per
 * device); the screens keep showing it.
 */

const ROOT = '[data-testid="screen-renderer-root"]'
/** The screens' own song background, so it can't be mistaken for the default. */
const SCREEN_COLOR = '#123456'
const SCREEN_COLOR_CSS = 'rgb(18, 52, 86)'
const BLACK_CSS = 'rgb(0, 0, 0)'

/** A line of lyrics on the projection (not its hidden measuring copy). */
function lyric(page: Page, text: string) {
  return page
    .locator(ROOT)
    .getByText(text, { exact: true })
    .and(page.locator(':not([aria-hidden="true"])'))
}

/** Sets (or, with null, clears) the song's own background through the API. */
async function setSongBackground(
  request: APIRequestContext,
  song: { id: number; title: string },
  background: Record<string, unknown> | null,
) {
  const res = await request.post('/api/songs', {
    data: { id: song.id, title: song.title, background },
  })
  expect(res.status()).toBe(200)
  expect((await res.json()).data.background).toEqual(background)
}

async function getSongBackground(request: APIRequestContext, songId: number) {
  const res = await request.get(`/api/songs/${songId}`)
  expect(res.status()).toBe(200)
  return (await res.json()).data.background
}

async function presentSong(
  request: APIRequestContext,
  songId: number,
  slideIndex = 0,
) {
  const res = await request.post('/api/presentation/temporary-song', {
    data: { songId, slideIndex },
  })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).data
}

/** Opens a screen's projection in its own tab. */
async function openProjection(context: BrowserContext, screenId: number) {
  const projection = await context.newPage()
  await projection.goto(`/screen/${screenId}`)
  await expect(projection.locator(ROOT)).toBeVisible({ timeout: 15000 })
  return projection
}

/** The projection's background layer. */
function projectionBackground(projection: Page) {
  return projection.locator(ROOT).getByTestId('screen-background')
}

async function expectImageBackground(
  background: ReturnType<Page['locator']>,
  url: string,
) {
  await expect(background).toHaveAttribute('data-background-type', 'image')
  await expect(
    background.getByTestId('screen-background-image'),
  ).toHaveAttribute('style', backgroundImageStyle(url))
}

async function expectColorBackground(
  background: ReturnType<Page['locator']>,
  color: string,
) {
  await expect(background).toHaveAttribute('data-background-type', 'color')
  await expect(background).toHaveCSS('background-color', color)
  await expect(background.getByTestId('screen-background-image')).toHaveCount(0)
}

/** Saves the song editor and waits for the song page it returns to. */
async function saveSongEditor(page: Page, songId: number) {
  const saved = page.waitForResponse(
    (res) =>
      new URL(res.url()).pathname === '/api/songs' &&
      res.request().method() === 'POST',
  )
  await page.getByTestId('song-editor-save').click()
  expect((await saved).status()).toBe(200)
  await expect(page).toHaveURL(new RegExp(`/songs/${songId}$`))
}

test.describe('Song background', () => {
  let primaryScreenId: number
  let stageScreenId: number
  let song: { id: number; title: string }
  let preexistingMediaIds = new Set<string>()
  const suffix = Date.now()
  const lyrics = [
    `Song background one ${suffix}`,
    `Song background two ${suffix}`,
  ]
  const screenBackground = { type: 'color', color: SCREEN_COLOR, opacity: 1 }

  test.beforeAll(async ({ request }) => {
    preexistingMediaIds = new Set(await listMediaIds(request))

    for (const type of ['primary', 'stage'] as const) {
      const res = await request.post('/api/screens', {
        data: { name: `E2E Song Background ${type} ${suffix}`, type },
      })
      expect([200, 201]).toContain(res.status())
      const id = (await res.json()).data.id as number
      await setScreenSongBackground(request, id, screenBackground)
      if (type === 'primary') primaryScreenId = id
      else stageScreenId = id
    }

    const title = `E2E Song Background ${suffix}`
    const res = await request.post('/api/songs', {
      data: {
        title,
        slides: lyrics.map((content, sortOrder) => ({ content, sortOrder })),
      },
    })
    expect(res.status()).toBe(201)
    const { data } = await res.json()
    expect(data.background).toBeNull()
    song = { id: data.id, title }
  })

  test.afterEach(async ({ request }) => {
    await request.post('/api/presentation/stop')
    if (song) await setSongBackground(request, song, null)
  })

  test.afterAll(async ({ request }) => {
    await request.post('/api/presentation/stop')
    if (song) await request.delete(`/api/songs/${song.id}`)
    for (const id of [primaryScreenId, stageScreenId]) {
      if (id) await request.delete(`/api/screens/${id}`)
    }
    await deleteMediaExcept(request, preexistingMediaIds)
  })

  test('the song editor saves an uploaded image as the song background', async ({
    page,
    request,
  }) => {
    await page.goto(`/songs/${song.id}/edit`)
    const section = page.getByTestId('song-background-section')
    await expect(section).toBeVisible({ timeout: 15000 })
    // No background of its own: the screens' settings apply.
    await expect(section.getByTestId('background-type-select')).toHaveText(
      label('presentation', 'screens.background.types.inherit'),
    )
    await expect(page.getByTestId('song-editor-save')).toBeDisabled()

    await chooseBackgroundType(page, 'image')
    const media = await uploadThroughPicker(page, request, {
      name: `e2e-song-background-${suffix}.png`,
      mimeType: 'image/png',
      buffer: PNG,
    })
    expect(media.kind).toBe('image')

    await saveSongEditor(page, song.id)
    const background = await getSongBackground(request, song.id)
    expect(background).toMatchObject({
      type: 'image',
      imageUrl: media.url,
      opacity: 1,
    })
    expect(background.imageUrl.startsWith(`${MEDIA_API}/`)).toBe(true)
  })

  test('audience screens show the song background, stage screens keep their own', async ({
    context,
    request,
  }) => {
    const media = await uploadMedia(request, PNG, 'image/png', 'song-bg.png')
    const background = {
      type: 'image',
      imageUrl: media.url,
      color: '#000000',
      opacity: 0.8,
    }
    await setSongBackground(request, song, background)

    // The server loads the stored background into the live song.
    const state = await presentSong(request, song.id)
    expect(state.temporaryContent.data.background).toEqual(background)

    const primary = await openProjection(context, primaryScreenId)
    await expect(lyric(primary, lyrics[0])).toBeVisible({ timeout: 10000 })
    await expectImageBackground(projectionBackground(primary), media.url)
    await expect(
      projectionBackground(primary).getByTestId('screen-background-image'),
    ).toHaveCSS('opacity', '0.8')

    const stage = await openProjection(context, stageScreenId)
    await expect(lyric(stage, lyrics[0])).toBeVisible({ timeout: 10000 })
    await expectColorBackground(projectionBackground(stage), SCREEN_COLOR_CSS)
  })

  test('a live song picks up background edits without being presented again', async ({
    context,
    page,
    request,
  }) => {
    const media = await uploadMedia(request, PNG, 'image/png', 'live-a.png')
    await setSongBackground(request, song, {
      type: 'image',
      imageUrl: media.url,
      color: '#000000',
      opacity: 1,
    })
    await presentSong(request, song.id, 1)

    const projection = await openProjection(context, primaryScreenId)
    await expect(lyric(projection, lyrics[1])).toBeVisible({ timeout: 10000 })
    await expectImageBackground(projectionBackground(projection), media.url)
    // Marks this document: a reload would drop it.
    await projection.evaluate(() => {
      ;(window as unknown as { __e2eSameDocument: boolean }).__e2eSameDocument =
        true
    })

    // Back to "Default (screen settings)" in the editor, and save.
    await page.goto(`/songs/${song.id}/edit`)
    await expect(page.getByTestId('song-background-section')).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByTestId('background-type-select')).toHaveText(
      label('presentation', 'screens.background.types.image'),
    )
    await chooseBackgroundType(page, 'inherit')
    await expect(page.getByTestId('background-media-picker')).toHaveCount(0)
    await saveSongEditor(page, song.id)
    expect(await getSongBackground(request, song.id)).toBeNull()

    // The projection falls back to the screen's own background, on the same
    // slide and in the same document.
    await expectColorBackground(
      projectionBackground(projection),
      SCREEN_COLOR_CSS,
    )
    await expect(lyric(projection, lyrics[1])).toBeVisible()

    // And a new image saved while live replaces it the same way.
    const next = await uploadMedia(request, PNG, 'image/png', 'live-b.png')
    await setSongBackground(request, song, {
      type: 'image',
      imageUrl: next.url,
      color: '#000000',
      opacity: 1,
    })
    await expectImageBackground(projectionBackground(projection), next.url)
    await expect(lyric(projection, lyrics[1])).toBeVisible()

    expect(
      await projection.evaluate(
        () =>
          (window as unknown as { __e2eSameDocument?: boolean })
            .__e2eSameDocument,
      ),
    ).toBe(true)
    const { data: live } = await (
      await request.get('/api/presentation/state')
    ).json()
    expect(live.temporaryContent.data).toMatchObject({
      songId: song.id,
      currentSlideIndex: 1,
      background: { type: 'image', imageUrl: next.url },
    })
  })

  test('the song page can hide the background in its preview, not on the screens', async ({
    context,
    page,
    request,
  }) => {
    const media = await uploadMedia(request, PNG, 'image/png', 'preview.png')
    await setSongBackground(request, song, {
      type: 'image',
      imageUrl: media.url,
      color: '#000000',
      opacity: 1,
    })
    await presentSong(request, song.id)

    await page.goto(`/songs/${song.id}`)
    const preview = page
      .getByTestId('live-preview')
      .getByTestId('screen-background')
    await expectImageBackground(preview, media.url)

    const toggle = page.getByTestId('song-preview-hide-background')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expectColorBackground(preview, BLACK_CSS)

    // The screens still show it.
    const projection = await openProjection(context, primaryScreenId)
    await expect(lyric(projection, lyrics[0])).toBeVisible({ timeout: 10000 })
    await expectImageBackground(projectionBackground(projection), media.url)

    // Remembered on this device.
    await page.reload()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true', {
      timeout: 15000,
    })
    await expectColorBackground(preview, BLACK_CSS)

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expectImageBackground(preview, media.url)
  })

  test('in the PowerPoint layout the toggle hides the background on the canvas and thumbnails', async ({
    page,
    request,
  }) => {
    const media = await uploadMedia(request, PNG, 'image/png', 'stage.png')
    await setSongBackground(request, song, {
      type: 'image',
      imageUrl: media.url,
      color: '#000000',
      opacity: 1,
    })

    await page.addInitScript(() => {
      window.localStorage.setItem('song-editor-layout', 'powerpoint')
    })
    await page.goto(`/songs/${song.id}`)

    const thumbnails = page.getByTestId('stage-thumbnail')
    await expect(thumbnails).toHaveCount(lyrics.length, { timeout: 15000 })
    const canvas = page
      .getByTestId('slide-canvas-box')
      .filter({ visible: true })
      .getByTestId('screen-background')
    const thumbnailBackgrounds = thumbnails.getByTestId('screen-background')

    const expectEverywhere = async (
      check: (background: ReturnType<Page['locator']>) => Promise<void>,
    ) => {
      await check(canvas)
      for (let i = 0; i < lyrics.length; i++) {
        await check(thumbnailBackgrounds.nth(i))
      }
    }

    await expectEverywhere((bg) => expectImageBackground(bg, media.url))

    const toggle = page.getByTestId('song-preview-hide-background')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expectEverywhere((bg) => expectColorBackground(bg, BLACK_CSS))

    await page.reload()
    await expect(thumbnails).toHaveCount(lyrics.length, { timeout: 15000 })
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expectEverywhere((bg) => expectColorBackground(bg, BLACK_CSS))

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expectEverywhere((bg) => expectImageBackground(bg, media.url))
  })
})
