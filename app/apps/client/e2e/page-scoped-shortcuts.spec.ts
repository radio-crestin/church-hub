import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * A page's own presentation shortcut means something only on that page —
 * "show the selected slide" on Songs, "show the selected verse" on Bible —
 * so the same key can be bound to both, and a page that is not open never
 * reacts. The OS-level key registration needs the desktop shell; what is
 * covered here is everything behind it: the settings that store the
 * bindings, the conflict rules, and the page-side handling of the event the
 * shortcut manager raises when a bound key is pressed.
 */

const SIDEBAR_SETTING = '/api/settings/app_settings/sidebar_configuration'

async function readSidebarConfig(request: APIRequestContext) {
  const response = await request.get(SIDEBAR_SETTING)
  if (response.status() === 404) return null
  const { data } = await response.json()
  return JSON.parse(data.value) as {
    items: Array<{
      type: string
      builtinId?: string
      settings?: { pageShortcuts?: Record<string, string[]> }
    }>
  }
}

async function createSong(request: APIRequestContext, title: string) {
  const response = await request.post('/api/songs', {
    data: {
      title,
      slides: [
        { content: 'First slide', sortOrder: 0 },
        { content: 'Second slide', sortOrder: 1 },
      ],
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data as { id: number }
}

async function liveSong(request: APIRequestContext) {
  const response = await request.get('/api/presentation/state')
  const { data } = await response.json()
  return data.temporaryContent?.type === 'song'
    ? {
        songId: data.temporaryContent.data.songId as number,
        slideIndex: data.temporaryContent.data.currentSlideIndex as number,
      }
    : null
}

test.describe('Page-scoped shortcuts', () => {
  test('the same key can be bound on Songs and on Bible, but not on a global action', async ({
    page,
    request,
  }) => {
    const before = await request.get(SIDEBAR_SETTING)
    const original =
      before.status() === 200
        ? ((await before.json()).data.value as string)
        : null

    // Start from pages with no keys of their own, whatever an earlier run left.
    if (original !== null) {
      const config = JSON.parse(original) as {
        items: Array<{ settings?: { pageShortcuts?: unknown } }>
      }
      for (const item of config.items) {
        if (item.settings) item.settings.pageShortcuts = undefined
      }
      await request.post('/api/settings/app_settings', {
        data: { key: 'sidebar_configuration', value: JSON.stringify(config) },
      })
    }

    try {
      await page.goto('/settings/shortcuts')
      await page.waitForLoadState('networkidle')

      const songs = page.getByTestId('page-shortcuts-songs-showSlide')
      await expect(songs).toBeVisible({ timeout: 10000 })
      await songs.getByTestId('page-shortcuts-songs-showSlide-add').click()
      const songsInput = songs.getByRole('textbox').last()
      await songsInput.focus()
      await songsInput.press('F9')
      await expect(songsInput).toHaveValue(/F9/)

      const bible = page.getByTestId('page-shortcuts-bible-showSlide')
      await bible.getByTestId('page-shortcuts-bible-showSlide-add').click()
      const bibleInput = bible.getByRole('textbox').last()
      await bibleInput.focus()
      await bibleInput.press('F9')
      await expect(bibleInput).toHaveValue(/F9/)

      // Both stored, each under its own page.
      await expect
        .poll(async () => {
          const config = await readSidebarConfig(request)
          const byPage = (id: string) =>
            config?.items.find(
              (item) => item.type === 'builtin' && item.builtinId === id,
            )?.settings?.pageShortcuts?.showSlide ?? []
          return { songs: byPage('songs'), bible: byPage('bible') }
        })
        .toEqual({ songs: ['F9'], bible: ['F9'] })

      // No conflict between the two pages.
      await expect(songs.getByText(/exist|already|deja/i)).toHaveCount(0)
      await expect(bible.getByText(/exist|already|deja/i)).toHaveCount(0)

      // The same key on the same page, for another action, is a conflict.
      const songsNext = page.getByTestId('page-shortcuts-songs-nextSlide')
      await songsNext.getByTestId('page-shortcuts-songs-nextSlide-add').click()
      const nextInput = songsNext.getByRole('textbox').last()
      await nextInput.focus()
      await nextInput.press('F9')
      await expect(songsNext.getByText(/exist|already|deja/i)).toHaveCount(1)
    } finally {
      if (original !== null) {
        await request.post('/api/settings/app_settings', {
          data: { key: 'sidebar_configuration', value: original },
        })
      } else {
        await request.delete(SIDEBAR_SETTING).catch(() => {})
      }
    }
  })

  test('the Songs "show the selected slide" event presents the selected slide — and only on Songs', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, `E2E Page Shortcut ${Date.now()}`)
    try {
      await page.addInitScript(() => {
        window.localStorage.setItem('song-editor-layout', 'normal')
      })
      await page.goto(`/songs/${song.id}`)
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('song-slide-1')).toBeVisible({
        timeout: 10000,
      })

      // Select the second slide with the keyboard (nothing is live yet).
      await page.keyboard.press('ArrowDown')

      // A key bound to Bible does nothing here.
      await page.evaluate(() => {
        window.dispatchEvent(
          new CustomEvent('page-shortcut', {
            detail: { pageId: 'bible', action: 'showSlide' },
          }),
        )
      })
      await page.waitForTimeout(500)
      expect(await liveSong(request)).toBeNull()

      // The Songs one shows the selected slide.
      await page.evaluate(() => {
        window.dispatchEvent(
          new CustomEvent('page-shortcut', {
            detail: { pageId: 'songs', action: 'showSlide' },
          }),
        )
      })
      await expect
        .poll(() => liveSong(request), { timeout: 10000 })
        .toEqual({ songId: song.id, slideIndex: 1 })
    } finally {
      await request.post('/api/presentation/clear-temporary').catch(() => {})
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })
})
