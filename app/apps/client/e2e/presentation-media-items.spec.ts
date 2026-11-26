import {
  type APIRequestContext,
  expect,
  type Locator,
  test,
} from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'
import { BUILT_IN_VIDEO } from './helpers/background-media'
import { startFakeAudioServer } from './helpers/fake-audio'
import { FAKE_AUDIO_PORT } from '../playwright.config'

/**
 * A presentation's music, video and verses items (T-181): music from a folder
 * or picked tracks starts as the presentation reaches the slide after it and
 * keeps playing; a video plays full screen and its step lasts as long as the
 * video; verses come from a topic or a book, all in order or N at random,
 * picked again on each run and loop. A Versete Biblice slide can show N of
 * its passages at random the same way.
 */

interface Entry {
  reference: string
  bookCode: string
  startChapter: number
  startVerse: number
  endVerse: number
}

interface Item {
  id: number
  itemType: string
  itemConfig: Record<string, unknown> | null
  verseteTineriEntries: Entry[]
  allVerseteTineriEntries: Entry[] | null
  music: { folderName: string | null; trackCount: number } | null
  video: { mediaId: string; url: string } | null
}

let stopFakeAudio: (() => void) | undefined
test.beforeAll(async () => {
  stopFakeAudio = await startFakeAudioServer()
})
test.afterAll(() => stopFakeAudio?.())

test.afterEach(async ({ request }) => {
  await request.post('/api/schedules/automation/stop')
  await request.post('/api/presentation/clear-temporary')
})

/** The built-in video in the video dialog, whatever else the gallery holds. */
function builtInVideoOption(dialog: Locator): Locator {
  return dialog.locator(
    `[data-testid="video-item-option"][data-media-id="${BUILT_IN_VIDEO.id}"]`,
  )
}

async function createPresentation(
  request: APIRequestContext,
  automation: Record<string, unknown> = {},
): Promise<number> {
  const res = await request.post('/api/schedules', {
    data: {
      title: `E2E Media Items ${Date.now()}`,
      automation: { autoplayByText: false, ...automation },
    },
  })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).data.id
}

async function addItem(
  request: APIRequestContext,
  scheduleId: number,
  data: Record<string, unknown>,
): Promise<Item> {
  const res = await request.post(`/api/schedules/${scheduleId}/items`, { data })
  expect(res.status(), await res.text()).toBe(201)
  return (await res.json()).data
}

const addMedia = (
  request: APIRequestContext,
  scheduleId: number,
  itemType: string,
  itemConfig: Record<string, unknown>,
) => addItem(request, scheduleId, { media: { itemType, itemConfig } })

const addAnnouncement = (
  request: APIRequestContext,
  scheduleId: number,
  text: string,
) =>
  addItem(request, scheduleId, {
    slideType: 'announcement',
    slideContent: `<p>${text}</p>`,
  })

async function items(
  request: APIRequestContext,
  scheduleId: number,
): Promise<Item[]> {
  const res = await request.get(`/api/schedules/${scheduleId}`)
  return (await res.json()).data.items
}

async function englishBible(request: APIRequestContext): Promise<number> {
  const all = (await (await request.get('/api/bible/translations')).json())
    .data as { id: number; language: string }[]
  const english = all.find((t) => t.language === 'en')
  expect(english, 'a bundled English Bible').toBeTruthy()
  return english!.id
}

const references = (item: Item) =>
  item.verseteTineriEntries.map((e) => e.reference).join(' | ')

async function presentationState(request: APIRequestContext) {
  const res = await request.get('/api/presentation/state')
  return (await res.json()).data
}

/** What the stand-in audio server plays now. */
async function playingFile(): Promise<string | null> {
  const res = await fetch(`http://127.0.0.1:${FAKE_AUDIO_PORT}/state`)
  return ((await res.json()) as { current_file: string | null }).current_file
}

async function hymns(request: APIRequestContext) {
  const folders = (await (await request.get('/api/music/folders')).json())
    .data as { id: number; name: string }[]
  const folder = folders.find((f) => f.name === 'Sample Hymns')
  expect(folder, 'the bundled sample hymns').toBeTruthy()
  const files = (await (await request.get('/api/music/files')).json()).data as {
    id: number
    title: string
    path: string
  }[]
  return { folderId: folder!.id, files }
}

test.describe('Presentation verses items', () => {
  test('a topic: all its passages in order, or N at random', async ({
    request,
  }) => {
    const translationId = await englishBible(request)
    const id = await createPresentation(request)
    const item = await addMedia(request, id, 'verses', {
      source: 'topic',
      topicKey: 'love',
      translationId,
      count: null,
    })

    // All of them, in the topic's order.
    const topics = (await (await request.get('/api/bible/topics')).json())
      .data as { id: number; key: string }[]
    const love = topics.find((t) => t.key === 'love')!
    const topic = (
      await (
        await request.get(
          `/api/bible/topics/${love.id}?translationId=${translationId}`,
        )
      ).json()
    ).data as { passages: { reference: string }[] }
    expect(item.verseteTineriEntries.map((e) => e.reference)).toEqual(
      topic.passages.map((p) => p.reference),
    )

    // Three at random: the same three until they are picked again.
    const set = await request.put(
      `/api/schedules/${id}/items/${item.id}/config`,
      {
        data: {
          itemConfig: {
            source: 'topic',
            topicKey: 'love',
            translationId,
            count: 3,
          },
        },
      },
    )
    expect(set.ok()).toBeTruthy()
    const [picked] = await items(request, id)
    expect(picked!.verseteTineriEntries).toHaveLength(3)
    const all = topic.passages.map((p) => p.reference)
    for (const e of picked!.verseteTineriEntries) {
      expect(all).toContain(e.reference)
    }
    expect(references((await items(request, id))[0]!)).toBe(references(picked!))

    // Picked again, they change (3 of 15: the same three in the same order
    // ten times over is about one chance in 2.7 thousand billion billion).
    await expect
      .poll(
        async () => {
          await request.post(`/api/schedules/${id}/repick`)
          return references((await items(request, id))[0]!)
        },
        { intervals: [0], timeout: 10_000 },
      )
      .not.toBe(references(picked!))
  })

  test('a book: N different verses, picked again on each loop', async ({
    request,
  }) => {
    const translationId = await englishBible(request)
    const id = await createPresentation(request, {
      autoplaySeconds: 1,
      loop: true,
    })
    await addMedia(request, id, 'verses', {
      source: 'book',
      bookCode: 'PSA',
      translationId,
      count: 2,
    })

    const run = await request.post(`/api/schedules/${id}/run`)
    expect((await run.json()).data).toMatchObject({
      running: true,
      stepCount: 2,
    })
    const [first] = await items(request, id)
    expect(first!.verseteTineriEntries).toHaveLength(2)
    for (const e of first!.verseteTineriEntries) {
      expect(e).toMatchObject({ bookCode: 'PSA' })
      expect(e.startVerse).toBe(e.endVerse)
    }
    expect(first!.verseteTineriEntries[0]!.reference).not.toBe(
      first!.verseteTineriEntries[1]!.reference,
    )

    // Each loop picks two others.
    await expect
      .poll(async () => references((await items(request, id))[0]!), {
        timeout: 15_000,
      })
      .not.toBe(references(first!))
  })

  test('a Versete Biblice slide shows N of its passages at random', async ({
    request,
  }) => {
    const translationId = await englishBible(request)
    const id = await createPresentation(request, { autoplaySeconds: 5 })
    const passage = (chapter: number) => ({
      translationId,
      bookCode: 'JHN',
      bookName: 'John',
      startChapter: chapter,
      startVerse: 1,
      endChapter: chapter,
      endVerse: 1,
    })
    const slide = await addItem(request, id, {
      slideType: 'versete_tineri',
      verseteTineriEntries: [1, 2, 3, 4].map(passage),
    })
    expect(slide.verseteTineriEntries).toHaveLength(4)
    expect(slide.allVerseteTineriEntries).toBeNull()

    const set = await request.put(
      `/api/schedules/${id}/items/${slide.id}/config`,
      { data: { itemConfig: { count: 2 } } },
    )
    expect(set.ok()).toBeTruthy()
    const [item] = await items(request, id)
    expect(item!.verseteTineriEntries).toHaveLength(2)
    // Its editor still gets every passage.
    expect(item!.allVerseteTineriEntries).toHaveLength(4)
    const run = await request.post(`/api/schedules/${id}/run`)
    expect((await run.json()).data).toMatchObject({ stepCount: 2 })
  })

  test('settings that do not fit are refused', async ({ request }) => {
    const id = await createPresentation(request)
    const bad = await request.post(`/api/schedules/${id}/items`, {
      data: { media: { itemType: 'verses', itemConfig: { source: 'book' } } },
    })
    expect(bad.ok()).toBeFalsy()
    const note = await addAnnouncement(request, id, 'Bun venit!')
    const put = await request.put(
      `/api/schedules/${id}/items/${note.id}/config`,
      { data: { itemConfig: { count: 2 } } },
    )
    expect(put.status()).toBe(400)
  })
})

test.describe('Presentation music items', () => {
  test('a folder starts in order at the slide after it, and keeps playing', async ({
    request,
  }) => {
    const { folderId, files } = await hymns(request)
    const id = await createPresentation(request, { autoplaySeconds: 1 })
    const music = await addMedia(request, id, 'music', {
      source: 'folder',
      folderId,
      shuffle: false,
    })
    expect(music.music).toEqual({ folderName: 'Sample Hymns', trackCount: 3 })
    await addAnnouncement(request, id, 'Bun venit!')
    await addAnnouncement(request, id, 'Slujba începe')

    const run = await request.post(`/api/schedules/${id}/run`)
    // The music is no step of its own.
    expect((await run.json()).data).toMatchObject({ stepCount: 2 })
    const first = [...files].sort((a, b) => a.title.localeCompare(b.title))[0]!
    await expect.poll(playingFile).toBe(first.path)

    // The next slide leaves it playing.
    await expect
      .poll(async () => (await presentationState(request)).temporaryContent)
      .toMatchObject({ data: { scheduleItemIndex: 1 } })
    expect(await playingFile()).toBe(first.path)
  })

  test('tracks picked by hand start when an operator reaches the slide after them', async ({
    request,
  }) => {
    const { files } = await hymns(request)
    const nearer = files.find((f) => f.title.startsWith('Nearer'))!
    const id = await createPresentation(request)
    await addAnnouncement(request, id, 'Înainte')
    await addMedia(request, id, 'music', {
      source: 'tracks',
      fileIds: [nearer.id],
      shuffle: true,
    })
    await addAnnouncement(request, id, 'După muzică')

    // An operator puts up the slide after the music, from any page.
    const present = (index: number, text: string) =>
      request.post('/api/presentation/temporary-announcement', {
        data: {
          content: `<p>${text}</p>`,
          scheduleId: id,
          scheduleItemIndex: index,
        },
      })
    expect((await present(1, 'După muzică')).ok()).toBeTruthy()
    await expect.poll(playingFile).toBe(nearer.path)

    // Playing it by hand from its row works too.
    const [, musicItem] = await items(request, id)
    const play = await request.post(
      `/api/schedules/${id}/items/${musicItem!.id}/play`,
    )
    expect(play.ok()).toBeTruthy()
    await expect.poll(playingFile).toBe(nearer.path)
  })
})

test.describe('Presentation video items', () => {
  test('a chosen video plays full screen for as long as it lasts', async ({
    request,
  }) => {
    const id = await createPresentation(request, { autoplaySeconds: 2 })
    const item = await addMedia(request, id, 'video', {
      source: 'file',
      mediaId: BUILT_IN_VIDEO.id,
    })
    expect(item.video).toEqual({
      mediaId: BUILT_IN_VIDEO.id,
      url: `/api/media/backgrounds/${BUILT_IN_VIDEO.id}`,
      seconds: 30.65,
    })

    const run = await request.post(`/api/schedules/${id}/run`)
    // The built-in video is 30.65 s long.
    expect((await run.json()).data).toMatchObject({ stepSeconds: 31 })
    expect((await presentationState(request)).temporaryContent).toMatchObject({
      type: 'video',
      data: {
        mediaId: BUILT_IN_VIDEO.id,
        scheduleId: id,
        scheduleItemIndex: 0,
      },
    })
  })

  test('a looping video plays again for the presentation slide time', async ({
    request,
  }) => {
    const id = await createPresentation(request, { autoplaySeconds: 2 })
    await addMedia(request, id, 'video', {
      source: 'file',
      mediaId: BUILT_IN_VIDEO.id,
      loop: true,
    })

    const run = await request.post(`/api/schedules/${id}/run`)
    expect((await run.json()).data).toMatchObject({ stepSeconds: 2 })
    expect((await presentationState(request)).temporaryContent).toMatchObject({
      type: 'video',
      data: { mediaId: BUILT_IN_VIDEO.id, loop: true },
    })
  })

  test('a background video is no step: it loops behind the slides after it', async ({
    request,
  }) => {
    const id = await createPresentation(request, { autoplaySeconds: 2 })
    await addAnnouncement(request, id, 'Before')
    await addMedia(request, id, 'video', {
      source: 'file',
      mediaId: BUILT_IN_VIDEO.id,
      background: true,
    })
    await addAnnouncement(request, id, 'After')

    // The slide before it has no background video.
    await request.post(`/api/schedules/${id}/run`)
    expect((await presentationState(request)).temporaryContent).toMatchObject({
      type: 'announcement',
      data: { content: '<p>Before</p>', scheduleItemIndex: 0 },
      presentationBackground: null,
    })

    // The next step is the slide after it, with the video behind it.
    const present = await request.post(`/api/schedules/${id}/steps/1/present`)
    expect(present.ok()).toBeTruthy()
    expect((await presentationState(request)).temporaryContent).toMatchObject({
      type: 'announcement',
      data: { content: '<p>After</p>', scheduleItemIndex: 1 },
      presentationBackground: {
        url: `/api/media/backgrounds/${BUILT_IN_VIDEO.id}`,
      },
    })

    // Anything shown outside the presentation drops it.
    await request.post('/api/presentation/temporary-announcement', {
      data: { content: '<p>Elsewhere</p>' },
    })
    expect(
      (await presentationState(request)).temporaryContent
        ?.presentationBackground ?? null,
    ).toBeNull()
  })

  test('settings with a loop or background that is not a switch are refused', async ({
    request,
  }) => {
    const id = await createPresentation(request)
    const res = await request.post(`/api/schedules/${id}/items`, {
      data: {
        media: {
          itemType: 'video',
          itemConfig: { source: 'random', background: 'yes' },
        },
      },
    })
    expect(res.ok()).toBeFalsy()
  })

  test('a random video is one of the gallery', async ({ request }) => {
    const id = await createPresentation(request)
    const item = await addMedia(request, id, 'video', { source: 'random' })
    const media = (await (await request.get('/api/media/backgrounds')).json())
      .data as { id: string; kind: string }[]
    const videos = media.filter((m) => m.kind === 'video').map((m) => m.id)
    expect(videos).toContain(item.video?.mediaId)
  })
})

test.describe('Presentation page', () => {
  test.beforeEach(async ({ page }) => {
    await setAppLanguage(page, 'en')
  })

  test('adds music, video and verses items, and plays the video on the preview', async ({
    page,
    request,
  }) => {
    const id = await createPresentation(request)
    await page.goto(`/schedules/${id}`)

    const addMenu = page.getByTestId('add-schedule-item-modal')
    const open = async (key: string) => {
      await page.getByTestId('schedule-add-item').click()
      await addMenu.getByTestId(`add-schedule-item-${key}`).click()
    }

    // Music: a folder, shuffled.
    await open('music')
    const music = page.getByTestId('music-item-dialog')
    await music.getByRole('radio', { name: /Sample Hymns/ }).click()
    await music.getByTestId('music-item-shuffle').click()
    await music.getByTestId('music-item-dialog-save').click()
    const rows = page.getByTestId('schedule-item')
    await expect(rows.nth(0)).toContainText('Music: Sample Hymns')
    await expect(rows.nth(0)).toContainText('3 tracks · shuffled')

    // Verses: a topic searched by its Romanian title, 2 at random.
    await open('verses')
    const verses = page.getByTestId('verses-item-dialog')
    await verses.getByRole('searchbox').fill('nădejdea')
    await verses.getByRole('radio', { name: /^Hope/ }).click()
    await verses
      .getByTestId('verses-item-count')
      .getByRole('radio')
      .nth(1)
      .click()
    await verses.getByLabel('How many').fill('2')
    await verses.getByTestId('verses-item-dialog-save').click()
    await expect(rows.nth(1)).toContainText('Verses: Hope')
    await expect(rows.nth(1)).toContainText('2 at random on each loop')

    // Video: the built-in one.
    await open('video')
    const video = page.getByTestId('video-item-dialog')
    await builtInVideoOption(video).click()
    await video.getByTestId('video-item-loop').click()
    await video.getByTestId('video-item-dialog-save').click()
    await expect(rows.nth(2)).toContainText('Video')
    await expect(rows.nth(2)).toContainText('This video · Loops')

    // Its step puts it on the screens, full screen.
    await rows.nth(2).click()
    await page.getByTestId('schedule-sub-item-2').click()
    await expect
      .poll(async () => (await presentationState(request)).temporaryContent)
      .toMatchObject({ type: 'video', data: { scheduleItemIndex: 2 } })
    await expect(page.getByTestId('screen-video').first()).toBeVisible()
    await expect(page.getByTestId('screen-video').first()).toHaveAttribute(
      'loop',
      '',
    )
  })

  test('a video set as the background shows behind the slide after it', async ({
    page,
    request,
  }) => {
    const id = await createPresentation(request)
    await addAnnouncement(request, id, 'Before')
    await page.goto(`/schedules/${id}`)

    await page.getByTestId('schedule-add-item').click()
    await page
      .getByTestId('add-schedule-item-modal')
      .getByTestId('add-schedule-item-video')
      .click()
    const video = page.getByTestId('video-item-dialog')
    await builtInVideoOption(video).click()
    await video.getByTestId('video-item-background').click()
    // A background always loops: there is nothing to choose.
    await expect(video.getByTestId('video-item-loop')).toHaveCount(0)
    await video.getByTestId('video-item-dialog-save').click()
    const rows = page.getByTestId('schedule-item')
    await expect(rows.nth(1)).toContainText('This video · Background')
    await addAnnouncement(request, id, 'After')
    await page.reload()

    // The slide after it is step 1: the video item has no step of its own.
    await rows.nth(2).click()
    await page.getByTestId('schedule-sub-item-1').click()
    await expect
      .poll(async () => (await presentationState(request)).temporaryContent)
      .toMatchObject({
        type: 'announcement',
        data: { scheduleItemIndex: 1 },
        presentationBackground: {
          url: `/api/media/backgrounds/${BUILT_IN_VIDEO.id}`,
        },
      })
    await expect(
      page
        .locator(
          '[data-testid="screen-background"][data-background-type="video"]',
        )
        .first(),
    ).toBeVisible()
  })
})
