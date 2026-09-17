import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { actionsMenuItem, openActionsMenu } from './helpers/actions-menu'

/**
 * The song and Bible pages used to carry a row of six unlabelled coloured
 * icons. Those are now one "More" button (three vertical dots) opening a
 * labelled menu, so what matters is that every action is still reachable,
 * still named, and still reports its on/off state. On the song page, marking
 * the song, adding it to a program and setting its key stay beside the menu
 * as named icon buttons, in that order.
 */

const SONG_ACTION_ITEMS = [
  'song-save-to-file',
  'song-toggle-layout',
  'song-edit',
] as const

const SONG_HEADER_BUTTONS = [
  'song-bookmark-toggle',
  'song-add-to-schedule',
  'song-set-key-line',
] as const

async function createSong(
  request: APIRequestContext,
  title: string,
): Promise<{ id: number; title: string }> {
  const res = await request.post('/api/songs', {
    data: { title, slides: [{ content: title, sortOrder: 0 }] },
  })
  const { data } = await res.json()
  return data
}

async function openSong(page: Page, songId: number) {
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto(`/songs/${songId}`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByTestId('song-actions-menu')).toBeVisible({
    timeout: 15000,
  })
}

test.describe('Page actions menu', () => {
  test('the song page exposes every action as a labelled menu row', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, `E2E Actions Menu ${Date.now()}`)

    try {
      await openSong(page, song.id)

      const trigger = page.getByTestId('song-actions-menu')
      await expect(trigger).toHaveAttribute('aria-expanded', 'false')
      await expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
      // An icon-only trigger, named for assistive tech and on hover.
      await expect(trigger).toHaveAttribute('aria-label', /.+/)
      expect((await trigger.innerText()).trim()).toBe('')

      const panel = await openActionsMenu(page, 'song-actions-menu')
      await expect(trigger).toHaveAttribute('aria-expanded', 'true')

      for (const testId of SONG_ACTION_ITEMS) {
        const row = panel.getByTestId(testId)
        await expect(row).toBeVisible()
        // Every row carries readable text, not just an icon.
        expect((await row.innerText()).trim().length).toBeGreaterThan(0)
      }

      // Marking the song and setting its key sit beside the menu, not in it.
      for (const testId of SONG_HEADER_BUTTONS) {
        await expect(panel.getByTestId(testId)).toHaveCount(0)
      }

      await page.keyboard.press('Escape')
      await expect(panel).toBeHidden()
      for (const testId of SONG_ACTION_ITEMS) {
        await expect(page.getByTestId(testId)).toHaveCount(0)
      }
      for (const testId of SONG_HEADER_BUTTONS) {
        const button = page.getByTestId(testId)
        await expect(button).toBeVisible()
        await expect(button).toHaveAttribute('aria-label', /.+/)
      }
    } finally {
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('the menu opens with the keyboard and closes back onto its trigger', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, `E2E Actions Keys ${Date.now()}`)

    try {
      await openSong(page, song.id)

      const trigger = page.getByTestId('song-actions-menu')
      await trigger.focus()
      await page.keyboard.press('ArrowDown')

      const panel = page.getByTestId('song-actions-menu-panel')
      await expect(panel).toBeVisible()
      await expect(panel.getByTestId('song-save-to-file')).toBeFocused()

      await page.keyboard.press('ArrowDown')
      await expect(panel.getByTestId('song-toggle-layout')).toBeFocused()

      await page.keyboard.press('Escape')
      await expect(panel).toBeHidden()
      await expect(trigger).toBeFocused()
    } finally {
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('choosing a row runs the action and closes the menu', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, `E2E Actions Run ${Date.now()}`)

    try {
      await openSong(page, song.id)

      const row = await actionsMenuItem(page, 'song-actions-menu', 'song-edit')
      await row.click()

      await expect(page.getByTestId('song-actions-menu-panel')).toBeHidden()
      await expect(page).toHaveURL(new RegExp(`/songs/${song.id}/edit`), {
        timeout: 10000,
      })
    } finally {
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('the bookmark button beside the menu reports its own on/off state', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, `E2E Actions Toggle ${Date.now()}`)

    try {
      await openSong(page, song.id)

      const bookmark = page.getByTestId('song-bookmark-toggle')
      await expect(bookmark).toHaveAttribute('aria-pressed', 'false')

      await bookmark.click()
      await expect(bookmark).toHaveAttribute('aria-pressed', 'true')

      // Put it back so the shared bookmark list is left as it was found.
      await bookmark.click()
      await expect(bookmark).toHaveAttribute('aria-pressed', 'false')
    } finally {
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('the add-to-program button sits between the bookmark and key buttons', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, `E2E Actions Program ${Date.now()}`)

    try {
      await openSong(page, song.id)

      const lefts: number[] = []
      for (const testId of SONG_HEADER_BUTTONS) {
        const box = await page.getByTestId(testId).boundingBox()
        if (!box) throw new Error(`${testId} is not visible`)
        lefts.push(box.x)
      }
      expect(lefts).toEqual([...lefts].sort((a, b) => a - b))

      await page.getByTestId('song-add-to-schedule').click()
      await expect(page.getByTestId('add-song-to-schedule-modal')).toBeVisible({
        timeout: 10000,
      })
      await page.getByTestId('add-song-to-schedule-cancel').click()
    } finally {
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('the key button beside the menu opens the key dialog', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, `E2E Actions Key ${Date.now()}`)

    try {
      await openSong(page, song.id)

      await page.getByTestId('song-set-key-line').click()
      await expect(page.locator('#keyLine')).toBeVisible({ timeout: 10000 })
      await expect(page.getByTestId('key-line-save')).toBeVisible()
      await page.keyboard.press('Escape')
    } finally {
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('the Bible page uses the same menu, disabled until a verse is open', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto('/bible')
    await expect(page.getByTestId('bible-actions-menu')).toBeVisible({
      timeout: 15000,
    })

    const panel = await openActionsMenu(page, 'bible-actions-menu')
    await expect(panel.getByTestId('bible-bookmark-toggle')).toBeVisible()
    await expect(panel.getByTestId('bible-add-to-schedule')).toBeVisible()

    // Nothing is in focus yet, so both rows explain themselves rather than
    // silently doing nothing.
    await expect(panel.getByTestId('bible-add-to-schedule')).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
  })
})
