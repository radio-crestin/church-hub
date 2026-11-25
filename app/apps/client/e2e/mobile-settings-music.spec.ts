import { expect, type Page, test } from '@playwright/test'

import roSidebar from '../src/i18n/locales/ro/sidebar.json' with { type: 'json' }
import { startFakeAudioServer } from './helpers/fake-audio'

/**
 * Settings and Music on a phone (CH-049): Settings opens on its list of
 * sections in a phone's browser, every settings page fits the screen with
 * nothing cut off at the side, the sidebar items show their names, and Music
 * keeps the player pinned over Piese, Bibliotecă and Coadă as tabs.
 */

const PHONE = { width: 390, height: 844 }

async function onPhone(page: Page) {
  await page.setViewportSize(PHONE)
  await page.addInitScript(() => {
    window.localStorage.setItem('church-hub-language', 'ro')
  })
}

/** What sticks out past the right edge of the screen (fixed bars aside). */
async function cutOff(page: Page) {
  return page.evaluate(() => {
    const out: string[] = []
    for (const el of document.querySelectorAll('body *')) {
      const box = el.getBoundingClientRect()
      if (box.width === 0 || box.right <= window.innerWidth + 1) continue
      if (getComputedStyle(el).position === 'fixed') continue
      // Inside a scroller of its own (a code block, a table) it can scroll.
      let scroller = el.parentElement
      while (scroller && scroller !== document.body) {
        const { overflowX } = getComputedStyle(scroller)
        if (overflowX === 'auto' || overflowX === 'scroll') break
        scroller = scroller.parentElement
      }
      if (scroller && scroller !== document.body) continue
      out.push(`${el.tagName} "${(el.textContent ?? '').trim().slice(0, 40)}"`)
    }
    return out
  })
}

const SETTINGS_PAGES = [
  'appearance',
  'profile',
  'users',
  'songs',
  'bible',
  'screens',
  'kiosk',
  'livestream',
  'shortcuts',
  'midi',
  'sidebar',
  'connection',
  'backup',
  'updates',
  'logs',
  'privacy',
  'about',
  'developer',
]

test.describe('Settings and Music on a phone', () => {
  test('Settings opens on its list, and a section has a way back', async ({
    page,
  }) => {
    await onPhone(page)
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/settings\/?$/)
    const users = page.getByRole('link', { name: 'Utilizatori' })
    await expect(users).toBeVisible()

    await users.click()
    await expect(page).toHaveURL(/\/settings\/users$/)
    await expect(
      page.getByRole('button', { name: 'Adaugă utilizator' }),
    ).toBeInViewport({ ratio: 1 })

    await page.getByRole('link', { name: 'Înapoi' }).click()
    await expect(page.getByRole('link', { name: 'Utilizatori' })).toBeVisible()
  })

  test('a desktop still opens a section next to the list', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/settings\/[a-z]+$/)
    await expect(page.getByTestId('settings-panel')).toBeVisible()
  })

  test('no settings page is cut off at the side', async ({ page }) => {
    test.setTimeout(120_000)
    await onPhone(page)
    for (const section of SETTINGS_PAGES) {
      await page.goto(`/settings/${section}`)
      await expect(page.getByTestId('settings-panel')).toBeVisible()
      await page.waitForTimeout(300)
      expect(await cutOff(page), `/settings/${section}`).toEqual([])
    }
  })

  test('the sidebar settings name each page', async ({ page }) => {
    await onPhone(page)
    await page.goto('/settings/sidebar')
    const panel = page.getByTestId('settings-panel')
    const { songs, bible, schedules } = roSidebar.navigation
    for (const name of [songs, bible, schedules]) {
      const label = panel.getByText(name, { exact: true }).first()
      await expect(label).toBeVisible()
      expect((await label.boundingBox())?.width ?? 0).toBeGreaterThan(30)
    }
    await expect(
      page.getByRole('button', { name: 'Adaugă Pagină Personalizată' }),
    ).toBeInViewport({ ratio: 1 })
  })

  test.describe('Music', () => {
    // The page asks the server's audio player for its state; without this
    // stand-in the server starts a real one on the port the next spec needs.
    let stopFakeAudio: (() => void) | undefined
    test.beforeAll(async () => {
      stopFakeAudio = await startFakeAudioServer()
    })
    test.afterAll(() => stopFakeAudio?.())

    test('Music keeps the player on top of Piese, Bibliotecă and Coadă', async ({
      page,
    }) => {
      await onPhone(page)
      await page.goto('/music')
      await expect(page.getByTestId('workspace-panel-deck')).toBeVisible()
      const tracksTab = page.getByTestId('workspace-tab-tracks')
      await expect(tracksTab).toHaveAttribute('aria-selected', 'true')
      await expect(page.getByTestId('workspace-panel-tracks')).toBeVisible()

      await page.getByTestId('workspace-tab-queue').click()
      await expect(page.getByTestId('workspace-panel-queue')).toBeVisible()
      await expect(page.getByTestId('workspace-panel-tracks')).toBeHidden()

      // A view picked in the library opens its tracks.
      await page.getByTestId('workspace-tab-library').click()
      await page.getByTestId('music-view-recent').click()
      await expect(tracksTab).toHaveAttribute('aria-selected', 'true')
      await expect(page.getByTestId('workspace-panel-tracks')).toBeVisible()
      expect(await cutOff(page)).toEqual([])
    })

    test('Music on a desktop keeps its three columns', async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto('/music')
      await expect(page.getByTestId('workspace-tab-tracks')).toHaveCount(0)
      await expect(page.getByTestId('workspace-panel-deck')).toHaveCount(0)
      await expect(page.getByTestId('music-view-recent')).toBeVisible()
      await expect(
        page.getByTestId('workspace-panel-player').getByText('Coadă', {
          exact: true,
        }),
      ).toBeVisible()
    })
  })
})
