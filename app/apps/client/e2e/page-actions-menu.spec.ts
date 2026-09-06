import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { actionsMenuItem, openActionsMenu } from './helpers/actions-menu'

/**
 * The song and Bible pages used to carry a row of six unlabelled coloured
 * icons. Those are now one "Actions" button opening a labelled menu, so what
 * matters is that every action is still reachable, still named, and still
 * reports its on/off state.
 */

const SONG_ACTION_ITEMS = [
  'song-bookmark-toggle',
  'song-add-to-schedule',
  'song-set-key-line',
  'song-save-to-file',
  'song-toggle-layout',
  'song-edit',
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

      const panel = await openActionsMenu(page, 'song-actions-menu')
      await expect(trigger).toHaveAttribute('aria-expanded', 'true')

      for (const testId of SONG_ACTION_ITEMS) {
        const row = panel.getByTestId(testId)
        await expect(row).toBeVisible()
        // Every row carries readable text, not just an icon.
        expect((await row.innerText()).trim().length).toBeGreaterThan(0)
      }

      // The old standalone icon buttons are gone from the header.
      await page.keyboard.press('Escape')
      await expect(panel).toBeHidden()
      for (const testId of SONG_ACTION_ITEMS) {
        await expect(page.getByTestId(testId)).toHaveCount(0)
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
      await expect(panel.getByTestId('song-bookmark-toggle')).toBeFocused()

      await page.keyboard.press('ArrowDown')
      await expect(panel.getByTestId('song-add-to-schedule')).toBeFocused()

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

      const row = await actionsMenuItem(
        page,
        'song-actions-menu',
        'song-add-to-schedule',
      )
      await row.click()

      await expect(page.getByTestId('song-actions-menu-panel')).toBeHidden()
      await expect(page.getByTestId('add-song-to-schedule-modal')).toBeVisible({
        timeout: 10000,
      })
      await page.getByTestId('add-song-to-schedule-cancel').click()
    } finally {
      await request.delete(`/api/songs/${song.id}`).catch(() => {})
    }
  })

  test('the bookmark row reports its own on/off state', async ({
    page,
    request,
  }) => {
    const song = await createSong(request, `E2E Actions Toggle ${Date.now()}`)

    try {
      await openSong(page, song.id)

      const bookmarkRow = await actionsMenuItem(
        page,
        'song-actions-menu',
        'song-bookmark-toggle',
      )
      await expect(bookmarkRow).toHaveAttribute('role', 'menuitemcheckbox')
      await expect(bookmarkRow).toHaveAttribute('aria-checked', 'false')

      await bookmarkRow.click()

      const bookmarkedRow = await actionsMenuItem(
        page,
        'song-actions-menu',
        'song-bookmark-toggle',
      )
      await expect(bookmarkedRow).toHaveAttribute('aria-checked', 'true')

      // Put it back so the shared bookmark list is left as it was found.
      await bookmarkedRow.click()
      const clearedRow = await actionsMenuItem(
        page,
        'song-actions-menu',
        'song-bookmark-toggle',
      )
      await expect(clearedRow).toHaveAttribute('aria-checked', 'false')
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
