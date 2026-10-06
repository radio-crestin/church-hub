import { type APIRequestContext, expect, test } from '@playwright/test'

import { FakeS3 } from './helpers/fake-s3'
import {
  addLinkSource,
  checkSource,
  openSongXml,
  publishSongFolder,
  setAutoUpdate,
} from './helpers/song-folder-source'

/**
 * The notification center: new songs from the song sources are one
 * notification, shown once as a pop-up and then kept under the bell (with
 * an unread count) until dismissed; it comes back only when a source changes.
 * It leads to Song discovery, where every song is ticked to import.
 */

const tag = String(Date.now()).replace(/\d/g, (d) => 'abcdefghij'[Number(d)])
const categoryName = `E2E Bell ${tag}`
const folder = `/bell/${tag}`
const knownLyrics = `${tag} lumina Ta ne calauzeste prin noapte catre casa`
const fresh = { id: 'a', title: `Cantare din clopot ${tag}` }
const known = { id: 'b', title: `Lumina Ta ne calauzeste ${tag}` }
const later = { id: 'c', title: `Cantare mai noua ${tag}` }

const folderSongs = (songs: { id: string; title: string }[]) =>
  songs.map((s) => ({
    ...s,
    xml: openSongXml(s.title, [
      s === known ? knownLyrics : `${tag} ${s.id} versuri care nu mai exista`,
    ]),
  }))

async function deleteSongsTitled(request: APIRequestContext, title: string) {
  const res = await request.get(
    `/api/songs/search?q=${encodeURIComponent(title)}`,
  )
  for (const hit of (await res.json()).data as {
    id: number
    title: string
  }[]) {
    if (hit.title === title) await request.delete(`/api/songs/${hit.id}`)
  }
}

test.describe('Notification center', () => {
  test.describe.configure({ mode: 'serial' })

  const s3 = new FakeS3()
  let sourceId = ''
  let libraryId = 0

  test.beforeAll(async ({ request }) => {
    await s3.start()
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
    expect(result).toMatchObject({ imported: 1, newCount: 1 })
  })

  test.afterAll(async ({ request }) => {
    await setAutoUpdate(request, true)
    if (sourceId) await request.delete(`/api/song-sources/${sourceId}`)
    for (const { title } of [fresh, known, later]) {
      await deleteSongsTitled(request, title)
    }
    if (libraryId) await request.delete(`/api/songs/${libraryId}`)
    await s3.stop()
  })

  test('new songs pop up once, then wait under the bell', async ({ page }) => {
    await page.goto('/songs')
    const popup = page.getByTestId('notification-popup')
    await expect(popup).toContainText(
      /1 new song added|1 cântare nouă adăugată/,
    )
    await expect(popup).toContainText(
      /1 more to review|Încă 1 cântare de verificat/,
    )
    await expect(popup).toContainText(categoryName)

    await popup.getByRole('button', { name: /Dismiss|Închide/ }).click()
    await expect(popup).toHaveCount(0)
    const bell = page.getByTestId('notification-bell')
    await expect(bell).toContainText('1')

    // Seen: no second pop-up, but still unread under the bell.
    await page.reload()
    await expect(bell).toBeVisible()
    await expect(page.getByTestId('notification-popup')).toHaveCount(0)
    await expect(bell).toContainText('1')

    await bell.click()
    const panel = page.getByRole('dialog', { name: /Notifications|Notificări/ })
    await expect(panel).toContainText(categoryName)
    await expect(bell).not.toContainText('1')

    await panel
      .getByRole('button', { name: /Review new songs|Verifică cântările noi/ })
      .click()
    await expect(page).toHaveURL(/\/songs\/discover/)
    await expect(
      page.getByRole('checkbox', { name: new RegExp(known.title) }),
    ).toBeChecked({ timeout: 30_000 })
    await expect(
      page.getByRole('checkbox', { name: categoryName, exact: true }),
    ).toBeChecked()
  })

  test('dismissed, it stays away until a source changes', async ({
    page,
    request,
  }) => {
    await page.goto('/songs')
    const bell = page.getByTestId('notification-bell')
    await bell.click()
    const panel = page.getByRole('dialog', { name: /Notifications|Notificări/ })
    await panel.getByRole('button', { name: /Dismiss|Închide/ }).click()
    await expect(bell).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('heading').first()).toBeVisible()
    await expect(bell).toHaveCount(0)

    // The source gets a new song: a new notification, popped up again.
    await setAutoUpdate(request, false)
    publishSongFolder(
      s3,
      folder,
      categoryName,
      folderSongs([fresh, known, later]),
      'two',
    )
    await checkSource(request, sourceId)
    await page.reload()
    await expect(page.getByTestId('notification-popup')).toContainText(
      /2 new songs to download|2 cântări noi de descărcat/,
    )
  })
})
