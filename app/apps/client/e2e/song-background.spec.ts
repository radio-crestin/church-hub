import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import {
  actionsMenuItem,
  openActionsMenu,
  selectAction,
} from './helpers/actions-menu'
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
 * edit reaches the projection without presenting the song again. When the
 * song's slides draw an image or a video, the song page's "More" menu can hide
 * it in the page's previews only ("Hide background in preview", remembered per
 * device); the screens keep showing it. Without media the option is left out.
 */

const ROOT = '[data-testid="screen-renderer-root"]'
/** The screens' own song background, so it can't be mistaken for the default. */
const SCREEN_COLOR = '#123456'
const SCREEN_COLOR_CSS = 'rgb(18, 52, 86)'
/** A song's own colour background. */
const SONG_COLOR = '#654321'
const SONG_COLOR_CSS = 'rgb(101, 67, 33)'
const BLACK_CSS = 'rgb(0, 0, 0)'

const ACTIONS_MENU = 'song-actions-menu'
const HIDE_BACKGROUND_ITEM = 'song-preview-hide-background'
/** Where the song page keeps the "Hide background in preview" choice. */
const HIDE_BACKGROUND_KEY = 'song-detail:hide-background'

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

type BackgroundCheck = (
  background: ReturnType<Page['locator']>,
) => Promise<void>

/**
 * Runs a check on every background of the PowerPoint layout: the canvas and
 * each filmstrip thumbnail.
 */
function stageBackgroundCheck(page: Page, slideCount: number) {
  const canvas = page
    .getByTestId('slide-canvas-box')
    .filter({ visible: true })
    .getByTestId('screen-background')
  const thumbnails = page
    .getByTestId('stage-thumbnail')
    .getByTestId('screen-background')

  return async (check: BackgroundCheck) => {
    await check(canvas)
    for (let i = 0; i < slideCount; i++) {
      await check(thumbnails.nth(i))
    }
  }
}

/** Closes the "More" menu with its trigger (Escape would also leave the page if it missed). */
async function closeActionsMenu(page: Page) {
  await page.getByTestId(ACTIONS_MENU).click()
  await expect(page.getByTestId(`${ACTIONS_MENU}-panel`)).toBeHidden()
}

/** Opens "More", checks the tick of "Hide background in preview", closes it. */
async function expectHideBackgroundChecked(page: Page, checked: boolean) {
  const item = await actionsMenuItem(page, ACTIONS_MENU, HIDE_BACKGROUND_ITEM)
  await expect(item).toHaveAttribute('role', 'menuitemcheckbox')
  await expect(item).toHaveAttribute('aria-checked', String(checked))
  await closeActionsMenu(page)
}

/** Opens "More" and checks it has no "Hide background in preview" row. */
async function expectNoHideBackgroundOption(page: Page) {
  const panel = await openActionsMenu(page, ACTIONS_MENU)
  await expect(panel.getByTestId('song-save-to-file')).toBeVisible()
  await expect(page.getByTestId(HIDE_BACKGROUND_ITEM)).toHaveCount(0)
  await closeActionsMenu(page)
}

/** Flips "Hide background in preview" from the "More" menu. */
async function toggleHideBackground(page: Page) {
  await selectAction(page, ACTIONS_MENU, HIDE_BACKGROUND_ITEM)
}

async function storedHideBackground(page: Page) {
  return page.evaluate(
    (key) => window.localStorage.getItem(key),
    HIDE_BACKGROUND_KEY,
  )
}

interface ScreenSummary {
  id: number
  name: string
  type: string
  isPreviewScreen: boolean
}

async function listScreens(
  request: APIRequestContext,
): Promise<ScreenSummary[]> {
  const res = await request.get('/api/screens')
  expect(res.ok()).toBeTruthy()
  return (await res.json()).data
}

/** Sets or clears a screen's preview flag (setting it clears every other). */
async function flagPreviewScreen(
  request: APIRequestContext,
  screen: ScreenSummary,
  isPreviewScreen: boolean,
) {
  const res = await request.post('/api/screens', {
    data: {
      id: screen.id,
      name: screen.name,
      type: screen.type,
      isPreviewScreen,
    },
  })
  expect(res.ok()).toBeTruthy()
}

/**
 * Makes a screen the one the song page's previews draw with, and returns how
 * to hand the flag back to the screen that had it.
 */
async function takePreviewScreen(
  request: APIRequestContext,
  screenId: number,
): Promise<() => Promise<void>> {
  const screens = await listScreens(request)
  const screen = screens.find((s) => s.id === screenId)
  expect(screen, `screen ${screenId} exists`).toBeTruthy()
  const previous = screens.find((s) => s.isPreviewScreen)
  await flagPreviewScreen(request, screen as ScreenSummary, true)
  return () =>
    previous
      ? flagPreviewScreen(request, previous, true)
      : flagPreviewScreen(request, screen as ScreenSummary, false)
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

  test('the "More" menu hides the background in the preview, not on the screens', async ({
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
    // Only in the menu now, not in the control panel's toolbar.
    await expect(page.getByTestId(HIDE_BACKGROUND_ITEM)).toHaveCount(0)

    await expectHideBackgroundChecked(page, false)
    await toggleHideBackground(page)
    await expectHideBackgroundChecked(page, true)
    await expectColorBackground(preview, BLACK_CSS)

    // The screens still show it.
    const projection = await openProjection(context, primaryScreenId)
    await expect(lyric(projection, lyrics[0])).toBeVisible({ timeout: 10000 })
    await expectImageBackground(projectionBackground(projection), media.url)

    // Remembered on this device.
    await page.reload()
    await expectColorBackground(preview, BLACK_CSS)
    await expectHideBackgroundChecked(page, true)

    await toggleHideBackground(page)
    await expectHideBackgroundChecked(page, false)
    await expectImageBackground(preview, media.url)
  })

  test('in the PowerPoint layout the "More" menu hides the background on the canvas and thumbnails', async ({
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
    const expectEverywhere = stageBackgroundCheck(page, lyrics.length)

    await expectEverywhere((bg) => expectImageBackground(bg, media.url))
    // Only in the menu now, not in the stage toolbar.
    await expect(page.getByTestId(HIDE_BACKGROUND_ITEM)).toHaveCount(0)

    await expectHideBackgroundChecked(page, false)
    await toggleHideBackground(page)
    await expectEverywhere((bg) => expectColorBackground(bg, BLACK_CSS))
    await expectHideBackgroundChecked(page, true)

    await page.reload()
    await expect(thumbnails).toHaveCount(lyrics.length, { timeout: 15000 })
    await expectEverywhere((bg) => expectColorBackground(bg, BLACK_CSS))
    await expectHideBackgroundChecked(page, true)

    await toggleHideBackground(page)
    await expectEverywhere((bg) => expectImageBackground(bg, media.url))
    await expectHideBackgroundChecked(page, false)
  })

  test('without an image or video the option is left out and the previews keep the colour', async ({
    page,
    request,
  }) => {
    // The previews draw with the preview screen: make it this spec's primary
    // screen, whose song backgrounds are a known colour.
    const restorePreviewScreen = await takePreviewScreen(
      request,
      primaryScreenId,
    )
    try {
      await presentSong(request, song.id)

      // Hidden on an earlier song that had an image.
      await page.goto(`/songs/${song.id}`)
      await page.evaluate(
        (key) => window.localStorage.setItem(key, 'true'),
        HIDE_BACKGROUND_KEY,
      )
      await page.reload()
      const preview = page
        .getByTestId('live-preview')
        .getByTestId('screen-background')

      // No background of its own: the screen's colour, not black.
      await expectColorBackground(preview, SCREEN_COLOR_CSS)
      await expectNoHideBackgroundOption(page)

      // Its own colour.
      await setSongBackground(request, song, {
        type: 'color',
        color: SONG_COLOR,
        opacity: 1,
      })
      await page.reload()
      await expectColorBackground(preview, SONG_COLOR_CSS)
      await expectNoHideBackgroundOption(page)

      // The PowerPoint layout's canvas and thumbnails too.
      await page.evaluate(() =>
        window.localStorage.setItem('song-editor-layout', 'powerpoint'),
      )
      await page.reload()
      await expect(page.getByTestId('stage-thumbnail')).toHaveCount(
        lyrics.length,
        { timeout: 15000 },
      )
      await stageBackgroundCheck(
        page,
        lyrics.length,
      )((bg) => expectColorBackground(bg, SONG_COLOR_CSS))
      await expectNoHideBackgroundOption(page)

      // The choice itself is kept, and applies again once there is an image.
      expect(await storedHideBackground(page)).toBe('true')
      const media = await uploadMedia(request, PNG, 'image/png', 'back.png')
      await setSongBackground(request, song, {
        type: 'image',
        imageUrl: media.url,
        color: '#000000',
        opacity: 1,
      })
      await page.evaluate(() =>
        window.localStorage.setItem('song-editor-layout', 'normal'),
      )
      await page.reload()
      await expectColorBackground(preview, BLACK_CSS)
      await expectHideBackgroundChecked(page, true)
    } finally {
      await restorePreviewScreen()
    }
  })

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

    test('the "More" menu fits the screen and its option works by touch', async ({
      page,
      request,
    }) => {
      const media = await uploadMedia(request, PNG, 'image/png', 'phone.png')
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

      await page.getByTestId(ACTIONS_MENU).tap()
      const panel = page.getByTestId(`${ACTIONS_MENU}-panel`)
      await expect(panel).toBeVisible()
      const box = await panel.boundingBox()
      expect(box).not.toBeNull()
      expect(box?.x ?? -1).toBeGreaterThanOrEqual(0)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390)

      await panel.getByTestId(HIDE_BACKGROUND_ITEM).tap()
      await expect(panel).toBeHidden()
      await expectColorBackground(preview, BLACK_CSS)
    })
  })
})
