import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { selectAction } from './helpers/actions-menu'

/**
 * Every saved change to a song's title or slides leaves a history entry: who
 * saved it, when, and the song before and after. The song page's More menu
 * opens the list, and any version can be put back.
 */

interface SongSlideInput {
  content: string
  sortOrder: number
  label?: string
}

interface HistoryEntry {
  id: number
  kind: 'created' | 'edited' | 'restored'
  editedByName: string
  titleBefore: string | null
  titleAfter: string
  changes: {
    titleChanged: boolean
    slidesAdded: number
    slidesRemoved: number
    slidesChanged: number
  }
}

const ORIGINAL_SLIDES: SongSlideInput[] = [
  { content: 'Amazing grace how sweet', sortOrder: 0, label: 'V1' },
  { content: 'That saved a wretch like me', sortOrder: 1, label: 'V2' },
]

async function saveSong(
  request: APIRequestContext,
  body: Record<string, unknown>,
): Promise<{ id: number; title: string }> {
  const res = await request.post('/api/songs', { data: body })
  expect(res.ok()).toBe(true)
  return (await res.json()).data
}

async function getHistory(
  request: APIRequestContext,
  songId: number,
): Promise<HistoryEntry[]> {
  const res = await request.get(`/api/songs/${songId}/history`)
  expect(res.ok()).toBe(true)
  return (await res.json()).data
}

async function openHistory(page: Page, songId: number) {
  await page.goto(`/songs/${songId}`)
  await expect(page.getByTestId('song-actions-menu')).toBeVisible({
    timeout: 15000,
  })
  await selectAction(page, 'song-actions-menu', 'song-history')
  await expect(page.getByTestId('song-history-dialog')).toBeVisible()
}

test.describe('Song edit history', () => {
  let songId: number
  const title = `E2E History ${Date.now()}`

  test.beforeEach(async ({ request }) => {
    const song = await saveSong(request, {
      title,
      slides: ORIGINAL_SLIDES,
    })
    songId = song.id
  })

  test.afterEach(async ({ request }) => {
    await request.delete(`/api/songs/${songId}`)
  })

  test('creating and editing a song records who, and what changed', async ({
    request,
  }) => {
    await saveSong(request, {
      id: songId,
      title: `${title} v2`,
      slides: [
        ORIGINAL_SLIDES[0],
        { content: 'Changed second line', sortOrder: 1, label: 'V2' },
        { content: 'A brand new third line', sortOrder: 2, label: 'V3' },
      ],
    })

    const history = await getHistory(request, songId)
    expect(history.map((entry) => entry.kind)).toEqual(['edited', 'created'])
    expect(history[0].editedByName).toBeTruthy()
    expect(history[0].titleBefore).toBe(title)
    expect(history[0].titleAfter).toBe(`${title} v2`)
    expect(history[0].changes).toEqual({
      titleChanged: true,
      slidesAdded: 1,
      slidesRemoved: 0,
      slidesChanged: 1,
    })

    const detail = await request.get(
      `/api/songs/${songId}/history/${history[0].id}`,
    )
    const { before, after } = (await detail.json()).data
    expect(before.slides).toHaveLength(2)
    expect(after.slides).toHaveLength(3)
    expect(after.slides[1].content).toBe('Changed second line')
  })

  test('a save that changes neither title nor slides adds no entry', async ({
    request,
  }) => {
    await saveSong(request, { id: songId, title, keyLine: 'G' })
    expect(await getHistory(request, songId)).toHaveLength(1)
  })

  test('the dialog lists the changes and restores the version before one', async ({
    page,
    request,
  }) => {
    await saveSong(request, {
      id: songId,
      title: `${title} edited`,
      slides: [{ content: 'Only one line now', sortOrder: 0, label: 'V1' }],
    })

    await openHistory(page, songId)

    const entries = page.getByTestId('song-history-entry')
    await expect(entries).toHaveCount(2)
    await expect(entries.first()).toHaveAttribute('data-kind', 'edited')
    await expect(entries.last()).toHaveAttribute('data-kind', 'created')
    await expect(
      entries.first().getByTestId('song-history-author'),
    ).not.toBeEmpty()

    await entries.first().getByRole('button').first().click()
    const details = page.getByTestId('song-history-details')
    await expect(details).toContainText('Only one line now')
    await expect(details).toContainText('Amazing grace how sweet')

    await page.getByTestId('song-history-restore-before').click()
    await page
      .getByTestId('song-history-restore-confirm')
      .locator('button')
      .last()
      .click()

    await expect(entries).toHaveCount(3)
    await expect(entries.first()).toHaveAttribute('data-kind', 'restored')

    const restored = await (await request.get(`/api/songs/${songId}`)).json()
    expect(restored.data.title).toBe(title)
    expect(
      restored.data.slides.map((slide: { content: string }) => slide.content),
    ).toEqual(ORIGINAL_SLIDES.map((slide) => slide.content))
  })

  test('the dialog fits a phone screen', async ({ page, request }) => {
    await saveSong(request, { id: songId, title: `${title} phone` })
    await page.setViewportSize({ width: 375, height: 700 })

    await openHistory(page, songId)

    const box = await page.getByTestId('song-history-dialog').boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(375)
  })
})
