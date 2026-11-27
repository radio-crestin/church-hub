import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { selectAction } from './helpers/actions-menu'
import { setAppLanguage } from './helpers/app-language'
import { readCuratedLibrary, signInCurator } from './helpers/curated-library'
import { FakeGoogle } from './helpers/fake-google'
import { FakeS3 } from './helpers/fake-s3'
import { SyncService } from './helpers/sync-service'

/**
 * The curated Church Hub Library (T-177): a church submits a song from its
 * action menu; a curator (LIBRARY_CURATORS on the sync service, signed in
 * with Google) approves it, merges a corrected version into it, and rejects
 * another. Each decision is checked in the bucket, as any reader sees it.
 */

const CURATOR = { sub: 'google-curator-1', email: 'curator@example.com' }
const STRANGER = { sub: 'google-stranger-1', email: 'stranger@example.com' }

const s3 = new FakeS3()
const google = new FakeGoogle()
const service = new SyncService()

async function createSong(
  request: APIRequestContext,
  title: string,
  lyrics: string,
  categoryId?: number,
) {
  const response = await request.post('/api/songs', {
    data: { title, categoryId, slides: [{ content: lyrics, sortOrder: 0 }] },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data as { id: number; title: string }
}

/** Submits the song from its page's action menu, with a note. */
async function submitFromSongPage(page: Page, songId: number, note: string) {
  await page.goto(`/songs/${songId}`)
  await selectAction(page, 'song-actions-menu', 'song-submit-to-library')
  const dialog = page.getByTestId('submit-to-library-dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByTestId('submit-to-library-note').fill(note)
  await dialog
    .getByRole('button', { name: 'Submit 1 song', exact: true })
    .click()
  await expect(page.getByText('1 song sent. Thank you!')).toBeVisible()
}

async function openCuratorPage(page: Page) {
  await page.goto('/settings/song-library')
  await expect(page.getByTestId('song-library-settings')).toBeVisible()
}

test.describe
  .serial('Church Hub Library', () => {
    test.setTimeout(120_000)

    let firstSongId = 0
    let librarySongId = ''

    test.beforeAll(async ({ request }) => {
      await s3.start()
      await google.start()
      await service.start(s3.endpoint, {
        ...google.serviceEnv,
        LIBRARY_CURATORS: `${CURATOR.email}, someone@example.com`,
        LIBRARY_RATE_LIMIT_PER_MINUTE: '1000',
      })
      await request.post('/api/sync/cloud/owner/sign-out')
    })

    // The texts the spec looks for are the English ones.
    test.beforeEach(({ page }) => setAppLanguage(page, 'en'))

    test.afterAll(async ({ request }) => {
      await request.post('/api/sync/cloud/owner/sign-out')
      await service.dispose()
      await google.stop()
      await s3.stop()
    })

    test('a church submits a song from its action menu', async ({
      page,
      request,
    }) => {
      const song = await createSong(
        request,
        'Library Hymn',
        'Holy holy holy<br>Lord God almighty',
      )
      firstSongId = song.id
      await submitFromSongPage(page, song.id, 'Words by a church member')
      // Nothing is published before a curator decides.
      expect((await readCuratedLibrary(s3)).manifest).toBeNull()
    })

    test('an account that is not a curator sees no queue', async ({
      page,
      request,
    }) => {
      google.account = STRANGER
      await signInCurator(request)
      await openCuratorPage(page)
      await expect(page.getByTestId('library-not-curator')).toContainText(
        STRANGER.email,
      )
      await expect(page.getByTestId('library-submission')).toHaveCount(0)
      await request.post('/api/sync/cloud/owner/sign-out')
    })

    test('a curator signs in with Google and approves it', async ({ page }) => {
      google.account = CURATOR
      await openCuratorPage(page)
      const popup = page.waitForEvent('popup')
      await page.getByTestId('library-curator-google').click()
      const window = await popup
      await window.waitForURL(/\/api\/sync\/cloud\/owner\/callback/)
      await expect(window.locator('body')).toContainText('Signed in as')

      const card = page.getByTestId('library-submission')
      await expect(card).toHaveCount(1, { timeout: 15_000 })
      await expect(card).toContainText('Library Hymn')
      await expect(card).toContainText('Words by a church member')
      await expect(card).toContainText('Lord God almighty')
      await card.getByTestId('library-approve').click()
      await expect(page.getByText('Song added to the library.')).toBeVisible()
      await expect(page.getByTestId('library-queue-empty')).toBeVisible()

      const { manifest, shards } = await readCuratedLibrary(s3)
      expect(manifest?.version).toBe(3)
      expect(manifest?.sourceId).toBe('church-hub')
      expect(manifest?.songs.map((song) => song.title)).toEqual([
        'Library Hymn',
      ])
      expect(shards[0]?.songs[0]?.xml).toContain('Lord God almighty')
      librarySongId = manifest?.songs[0]?.id ?? ''
    })

    test('a corrected version is merged into the library song', async ({
      page,
      request,
    }) => {
      const before = (await readCuratedLibrary(s3)).manifest
      const edited = await request.post('/api/songs', {
        data: {
          id: firstSongId,
          title: 'Library Hymn',
          slides: [
            {
              content: 'Holy holy holy<br>Early in the morning',
              sortOrder: 0,
            },
          ],
        },
      })
      expect(edited.ok()).toBe(true)
      await submitFromSongPage(page, firstSongId, 'Fixed the last line')

      await openCuratorPage(page)
      const card = page.getByTestId('library-submission')
      await expect(card).toHaveCount(1, { timeout: 15_000 })
      // The library already has a song with this title: merge into it.
      const matches = card.getByTestId('library-matches')
      await expect(matches).toContainText('Library Hymn')
      await expect(matches).toContainText('same title')
      await matches.getByTestId('library-merge-match').click()
      await expect(
        page.getByText('Song merged into the library.'),
      ).toBeVisible()

      const { manifest, shards } = await readCuratedLibrary(s3)
      expect(manifest?.songs).toHaveLength(1)
      expect(manifest?.songs[0]?.id).toBe(librarySongId)
      expect(manifest?.checksum).not.toBe(before?.checksum)
      expect(shards[0]?.songs[0]?.xml).toContain('Early in the morning')
    })

    test('a curator rejects a song, and nothing is published', async ({
      page,
      request,
    }) => {
      const before = (await readCuratedLibrary(s3)).manifest
      const song = await createSong(request, 'Not For Sharing', 'Private words')
      await submitFromSongPage(page, song.id, '')

      await openCuratorPage(page)
      const card = page.getByTestId('library-submission')
      await expect(card).toContainText('Not For Sharing', { timeout: 15_000 })
      await card.getByTestId('library-reject').click()
      const dialog = page.getByTestId('library-reject-dialog')
      await dialog.getByRole('textbox').fill('Not a congregational song')
      await dialog.getByRole('button', { name: 'Reject', exact: true }).click()
      await expect(page.getByText('Song rejected.')).toBeVisible()
      await expect(page.getByTestId('library-queue-empty')).toBeVisible()

      expect((await readCuratedLibrary(s3)).manifest?.checksum).toBe(
        before?.checksum,
      )
    })

    test('a whole category and a picked song are sent at once', async ({
      page,
      request,
    }) => {
      const uniq = Date.now()
      const category = (
        await (
          await request.post('/api/categories', {
            data: { name: `Library Batch ${uniq}` },
          })
        ).json()
      ).data as { id: number }
      await createSong(
        request,
        `Batch One ${uniq}`,
        'First batch song',
        category.id,
      )
      await createSong(
        request,
        `Batch Two ${uniq}`,
        'Second batch song',
        category.id,
      )
      await createSong(request, `Picked Alone ${uniq}`, 'A song picked by hand')

      await page.goto('/settings/songs')
      await page
        .getByTestId(`category-submit-to-library-${category.id}`)
        .click()
      const dialog = page.getByTestId('submit-to-library-dialog')
      await expect(dialog).toBeVisible()
      await dialog
        .getByTestId('submit-to-library-search')
        .fill(`Picked Alone ${uniq}`)
      await dialog
        .getByTestId('submit-to-library-results')
        .getByRole('checkbox')
        .first()
        .check()
      await dialog.getByTestId('submit-to-library-note').fill('Our youth songs')
      await dialog
        .getByRole('button', { name: 'Submit 3 songs', exact: true })
        .click()
      await expect(page.getByText('3 songs sent. Thank you!')).toBeVisible()

      await openCuratorPage(page)
      const cards = page.getByTestId('library-submission')
      await expect(cards).toHaveCount(3, { timeout: 15_000 })
      for (const title of [
        `Batch One ${uniq}`,
        `Batch Two ${uniq}`,
        `Picked Alone ${uniq}`,
      ]) {
        await expect(cards.filter({ hasText: title })).toHaveCount(1)
      }
      await expect(cards.first()).toContainText('Our youth songs')
    })
  })
