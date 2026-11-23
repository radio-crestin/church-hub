import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { label } from './helpers/background-media'

/**
 * The song's title in a corner of the projector, so the room remembers it
 * (T-029). It is an element of a screen's song layout, off until a screen
 * turns it on, and it shows on every slide of the song — first (with the
 * gama) and last (with the Amin) too — staying put from verse to verse.
 */

const KEY = 'GAMA-Re'
const LYRICS = ['Title first verse', 'Title middle verse', 'Title last verse']

async function createScreen(request: APIRequestContext): Promise<number> {
  const response = await request.post('/api/screens', {
    data: { name: `E2E SongTitle ${Date.now()}`, type: 'primary' },
  })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data.id as number
}

async function songConfig(request: APIRequestContext, screenId: number) {
  const { data } = await (await request.get(`/api/screens/${screenId}`)).json()
  return data.contentConfigs
}

async function showTitle(request: APIRequestContext, screenId: number) {
  const { song } = await songConfig(request, screenId)
  song.songTitle = { ...song.songTitle, hidden: false }
  const put = await request.put(`/api/screens/${screenId}/config/song`, {
    data: { config: song },
  })
  expect(put.ok()).toBeTruthy()
}

async function createSong(
  request: APIRequestContext,
  title: string,
  extra: Record<string, unknown> = {},
) {
  const response = await request.post('/api/songs', {
    data: {
      ...extra,
      title,
      keyLine: KEY,
      slides: LYRICS.map((text, i) => ({
        content: `<p>${text}${i === LYRICS.length - 1 ? ' Amin' : ''}</p>`,
        sortOrder: i,
      })),
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data.id as number
}

async function navigate(request: APIRequestContext, direction: string) {
  const response = await request.post('/api/presentation/navigate-temporary', {
    data: { direction, requestTimestamp: Date.now() },
  })
  expect(response.ok()).toBeTruthy()
}

/** The text as drawn: each text is preceded by a hidden copy used to measure it. */
function shown(page: Page, text: string) {
  return page.getByText(text, { exact: true }).last()
}

/** Lowest opacity the title reaches while `act` runs, sampled every frame. */
async function lowestOpacityDuring(
  page: Page,
  text: string,
  act: () => Promise<void>,
) {
  await page.evaluate((tracked) => {
    const w = window as unknown as { __min: number; __stop: boolean }
    w.__min = 1
    w.__stop = false
    const tick = () => {
      const leaf = [...document.querySelectorAll<HTMLElement>('div, span, p')]
        .filter((el) => el.textContent?.trim() === tracked)
        .filter((el) => !el.closest('[aria-hidden="true"]'))
        .filter((el) => !el.querySelector('[aria-hidden="true"]'))
        .pop()
      let opacity = 0
      if (leaf) {
        opacity = 1
        for (let n: HTMLElement | null = leaf; n; n = n.parentElement) {
          opacity *= Number.parseFloat(getComputedStyle(n).opacity)
        }
      }
      w.__min = Math.min(w.__min, opacity)
      if (!w.__stop) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, text)
  await act()
  return page.evaluate(() => {
    const w = window as unknown as { __min: number; __stop: boolean }
    w.__stop = true
    return w.__min
  })
}

test.describe('Song title on the projector', () => {
  let screenId: number
  let songId: number
  let title: string

  test.beforeEach(async ({ request }) => {
    screenId = await createScreen(request)
    title = `Cântarea de test ${Date.now()}`
    songId = await createSong(request, title)
  })

  test.afterEach(async ({ request }) => {
    await request.post('/api/presentation/stop')
    await request.delete(`/api/songs/${songId}`).catch(() => {})
    await request.delete(`/api/screens/${screenId}`).catch(() => {})
  })

  test('is off on a new screen, set on the song layout alone', async ({
    page,
    request,
  }) => {
    const configs = await songConfig(request, screenId)
    expect(configs.song.songTitle).toMatchObject({ hidden: true })
    expect(configs.song.songTitle).toHaveProperty('constraints')
    expect(configs.song_first_slide.songTitle).toBeUndefined()
    expect(configs.song_last_slide.songTitle).toBeUndefined()

    await request.post('/api/presentation/temporary-song', {
      data: { songId, slideIndex: 0 },
    })
    await page.goto(`/screen/${screenId}`)
    await expect(shown(page, LYRICS[0])).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(title, { exact: true })).toHaveCount(0)
  })

  test('once on, shows on every slide and stays put between verses', async ({
    page,
    request,
  }) => {
    await showTitle(request, screenId)
    await request.post('/api/presentation/temporary-song', {
      data: { songId, slideIndex: 0 },
    })
    await page.goto(`/screen/${screenId}`)

    // First slide: its own layout (with the gama) still shows the title.
    await expect(shown(page, LYRICS[0])).toBeVisible({ timeout: 15000 })
    await expect(shown(page, KEY)).toBeVisible()
    await expect(shown(page, title)).toBeVisible()
    await page.waitForTimeout(800)

    // Moving on, the verse changes but the title never fades.
    const lowest = await lowestOpacityDuring(page, title, async () => {
      await navigate(request, 'next')
      await expect(shown(page, LYRICS[1])).toBeVisible()
      await page.waitForTimeout(800)
    })
    expect(lowest).toBeGreaterThan(0.95)

    // Last slide: its own layout (with the Amin) shows it too.
    await navigate(request, 'next')
    // ("Amin" stays in the verse's text unless the screen's Amin is on.)
    await expect(page.getByText(LYRICS[2]).last()).toBeVisible()
    await expect(shown(page, title)).toBeVisible()
  })

  test('a numbered song shows its songbook and number', async ({
    page,
    request,
  }) => {
    // The songbook "Pe Drumul Credinței" (PDC), as the church's songs are
    // stored: the number leads the title, "019 - La masa Ta…".
    const name = 'Pe Drumul Credinței'
    const { data: categories } = await (
      await request.get('/api/categories')
    ).json()
    let category = categories.find((c: { name: string }) => c.name === name)
    const created = !category
    if (created) {
      category = (
        await (await request.post('/api/categories', { data: { name } })).json()
      ).data
    }
    const stamp = Date.now()
    const numbered = await createSong(request, `019 - La masa Ta ${stamp}`, {
      categoryId: category.id,
    })
    // A number kept only as the hymn number counts too.
    const hymn = await createSong(request, `Cântare cu număr ${stamp}`, {
      hymnNumber: '12',
    })

    try {
      await showTitle(request, screenId)
      await request.post('/api/presentation/temporary-song', {
        data: { songId: numbered, slideIndex: 1 },
      })
      await page.goto(`/screen/${screenId}`)
      await expect(shown(page, `PDC 19 · La masa Ta ${stamp}`)).toBeVisible({
        timeout: 15000,
      })

      await request.post('/api/presentation/temporary-song', {
        data: { songId: hymn, slideIndex: 1 },
      })
      await expect(shown(page, `12 · Cântare cu număr ${stamp}`)).toBeVisible()
    } finally {
      await request.post('/api/presentation/stop')
      await request.delete(`/api/songs/${numbered}`)
      await request.delete(`/api/songs/${hymn}`)
      if (created) await request.delete(`/api/categories/${category.id}`)
    }
  })

  test('is turned on from the screen editor', async ({ page, request }) => {
    await page.goto('/settings/screens')
    await page
      .locator(`[data-testid="screen-card"][data-screen-id="${screenId}"]`)
      .getByRole('button', {
        name: label('settings', 'sections.screens.actions.edit'),
      })
      .click()
    await expect(page.getByTestId('screen-editor-save')).toBeVisible({
      timeout: 10000,
    })
    await page.getByTestId('screen-editor-content-type').click()
    await page
      .getByTestId('screen-editor-content-type-option')
      .filter({ hasText: label('presentation', 'screens.contentTypes.song') })
      .locator('button')
      .first()
      .click()

    await page.getByTestId('screen-editor-element-songTitle').click()
    const element = page.getByTestId('screen-editor-element-settings')
    await expect(
      element.getByText(label('presentation', 'screens.elements.songTitle')),
    ).toBeVisible()
    await element
      .getByText(label('presentation', 'screens.visibility.hideElement'))
      .click()
    await page.getByTestId('screen-editor-save').click()

    await expect
      .poll(async () => (await songConfig(request, screenId)).song.songTitle)
      .toMatchObject({ hidden: false })
  })
})
