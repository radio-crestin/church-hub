import { type APIRequestContext, expect, test } from '@playwright/test'

import { FakeS3 } from './helpers/fake-s3'
import {
  addLinkSource,
  checkSource,
  clearNotifications,
  deleteCategoriesNamed,
  openSongXml,
  publishSongFolder,
  setAutoUpdate,
} from './helpers/song-folder-source'

/**
 * Notifications: what the song sync did (or what waits for approval) and new
 * app versions. A new one pops up once, then waits on the notifications
 * page, opened from the sidebar item that counts the unread ones. A running
 * check shows only on that page, where it can be cancelled.
 */

// Letters only: titles lose their digits on the way in.
const tag = String(Date.now()).replace(/\d/g, (d) => 'abcdefghij'[Number(d)])
const categoryName = `E2E Notificari ${tag}`
const folder = `/notifications/${tag}`
const knownLyrics = `${tag} lumina Ta ne calauzeste prin noapte catre casa`
const fresh = {
  id: 'a',
  title: `Cantare din notificare ${tag}`,
  lyrics: `${tag} zori de dimineata peste dealuri verzi`,
}
const known = {
  id: 'b',
  title: `Lumina Ta ne calauzeste ${tag}`,
  lyrics: knownLyrics,
}
const later = {
  id: 'c',
  title: `Cantare mai noua ${tag}`,
  lyrics: `${tag} rauri limpezi curg spre marea cea larga`,
}

// Lyrics unlike each other, so each is a song of its own, not a version.
const folderSongs = (songs: { id: string; title: string; lyrics: string }[]) =>
  songs.map((s) => ({ ...s, xml: openSongXml(s.title, [s.lyrics]) }))

async function songsTitled(request: APIRequestContext, title: string) {
  const res = await request.get(
    `/api/songs/search?q=${encodeURIComponent(title)}`,
  )
  return ((await res.json()).data as { id: number; title: string }[]).filter(
    (hit) => hit.title === title,
  )
}

test.describe('Notifications', () => {
  test.describe.configure({ mode: 'serial' })

  const s3 = new FakeS3()
  let sourceId = ''
  let libraryId = 0

  test.beforeAll(async ({ request }) => {
    await s3.start()
    await clearNotifications(request)
    const library = await request.post('/api/songs', {
      data: {
        title: `Lumina Ta ${tag}`,
        slides: [{ content: `<p>${knownLyrics}</p>`, sortOrder: 0 }],
      },
    })
    libraryId = (await library.json()).data.id
    const url = publishSongFolder(
      s3,
      folder,
      categoryName,
      folderSongs([fresh, known]),
      'one',
    )
    sourceId = await addLinkSource(request, url)
    await setAutoUpdate(request, true)
    const result = await checkSource(request, sourceId)
    expect(result).toMatchObject({ imported: 1, newCount: 0, similarCount: 1 })
  })

  test.afterAll(async ({ request }) => {
    await deleteCategoriesNamed(request, [categoryName])
    await setAutoUpdate(request, true)
    if (sourceId) await request.delete(`/api/song-sources/${sourceId}`)
    for (const { title } of [fresh, known, later]) {
      for (const hit of await songsTitled(request, title)) {
        await request.delete(`/api/songs/${hit.id}`)
      }
    }
    if (libraryId) await request.delete(`/api/songs/${libraryId}`)
    await clearNotifications(request)
    await s3.stop()
  })

  test('a finished sync pops up once, then waits on the notifications page', async ({
    page,
  }) => {
    await page.goto('/songs')
    const popup = page.getByTestId('notification-popup')
    await expect(popup).toContainText(/Songs synced|Cântări sincronizate/)
    await expect(popup).toContainText(
      /1 new song added|1 cântare nouă adăugată/,
    )
    await popup.getByRole('button', { name: /^(Close|Închide)$/ }).click()
    await expect(popup).toHaveCount(0)

    // Seen: no second pop-up, but the dot on the sidebar bell.
    const item = page.getByTestId('sidebar-notifications-bell')
    const dot = page.getByTestId('sidebar-notifications-dot')
    await expect(dot).toBeVisible()
    await page.reload()
    await expect(item).toBeVisible()
    await expect(page.getByTestId('notification-popup')).toHaveCount(0)

    // The page lists it with its songs.
    await item.click()
    await expect(page).toHaveURL(/\/notifications$/)
    const card = page.getByTestId('notification-songs-synced')
    await expect(card).toContainText(/Added \(1\)|Adăugate \(1\)/)
    // Opening the page reads nothing; clicking the notification does.
    await page.reload()
    await expect(dot).toBeVisible()
    await card.getByRole('link', { name: fresh.title }).click()
    await expect(dot).toHaveCount(0)
    await expect(page).toHaveURL(/\/songs\/\d+/)
  })

  test('with sync without approval off, the songs wait and sync from the notification', async ({
    page,
    request,
  }) => {
    await setAutoUpdate(request, false)
    publishSongFolder(
      s3,
      folder,
      categoryName,
      folderSongs([fresh, known, later]),
      'two',
    )
    const result = await checkSource(request, sourceId)
    expect(result).toMatchObject({ imported: 0, newCount: 1 })
    expect(await songsTitled(request, later.title)).toHaveLength(0)

    // The songs page offers to sync it, next to "Download songs".
    await page.goto('/songs')
    await expect(page.getByTestId('discover-sync-pending')).toContainText('1')

    await page.goto('/notifications')
    const pending = page.getByTestId('notification-songs-pending')
    await expect(pending).toContainText(later.title)
    await expect(pending).not.toContainText(known.title)
    await pending.getByTestId('notification-sync-now').click()

    await expect(pending).toHaveCount(0)
    await expect(
      page.getByTestId('notification-songs-synced').first(),
    ).toContainText(later.title)
    expect(await songsTitled(request, later.title)).toHaveLength(1)
    await expect(page.getByTestId('discover-sync-pending')).toHaveCount(0)
  })

  test('a running check shows only on the page, and can be cancelled', async ({
    page,
    request,
  }) => {
    // The last test's notifications stay unread (none was clicked): read
    // them, so only the running check could show here.
    await request.post('/api/notifications/read')
    s3.stalled.add(`${folder}/manifest.json`)
    const run = await request.post('/api/song-sources/updates/run', {
      data: { sourceIds: [sourceId], force: true },
    })
    expect(run.status()).toBe(202)

    await page.goto('/songs')
    await expect(page.getByRole('heading').first()).toBeVisible()
    await expect(page.getByTestId('notification-popup')).toHaveCount(0)

    await page.goto('/notifications')
    const checking = page.getByTestId('notification-songs-checking')
    await expect(checking).toBeVisible()
    await checking.getByTestId('notification-cancel-check').click()
    await expect(checking).toHaveCount(0)
    const state = (
      await (await request.get('/api/song-sources/updates')).json()
    ).data
    expect(state.running).toBe(false)
    s3.stalled.clear()
  })

  test('a new app version is in the history, until removed', async ({
    page,
    request,
  }) => {
    const recorded = await request.post('/api/notifications/app-update', {
      data: { version: '99.0.0' },
    })
    expect(recorded.ok()).toBeTruthy()

    await page.goto('/notifications')
    const card = page.getByTestId('notification-app-update')
    await expect(card).toContainText('v99.0.0')
    await card.hover()
    await card.getByRole('button', { name: /^(Remove|Șterge)$/ }).click()
    await expect(card).toHaveCount(0)
    await page.reload()
    await expect(
      page.getByRole('heading', { name: /^(Notifications|Notificări)$/ }),
    ).toBeVisible()
    await expect(page.getByTestId('notification-app-update')).toHaveCount(0)
  })
})
