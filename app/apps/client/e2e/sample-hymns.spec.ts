import { DatabaseSync } from 'node:sqlite'
import { type APIRequestContext, expect, test } from '@playwright/test'

import { ExtraServer } from './helpers/extra-server'

/**
 * The music library starts with three public-domain hymns bundled with the
 * app (T-113), instead of a three-second "Sample Audio" clip. An install that
 * had the old clip gets the hymns in its place on its next start.
 */

const HYMNS = [
  'Amazing Grace',
  'Ein feste Burg ist unser Gott',
  'Nearer, My God, to Thee',
]

interface MusicFile {
  title: string | null
  filename: string
  duration: number | null
}

async function libraryTitles(api: APIRequestContext): Promise<string[]> {
  const res = await api.get('/api/music/files')
  expect(res.ok()).toBe(true)
  const files = (await res.json()).data as MusicFile[]
  return files.map((file) => file.title ?? file.filename).sort()
}

test.describe('Sample hymns', () => {
  test.describe.configure({ mode: 'serial', timeout: 600_000 })

  let server: ExtraServer

  test.beforeAll(async () => {
    server = new ExtraServer()
    await server.start()
  })

  test.afterAll(async () => {
    await server?.dispose()
  })

  test('a fresh install has the sample hymns in its music library', async () => {
    const api = await server.adminRequest()
    // The tags are read just after start.
    await expect.poll(() => libraryTitles(api)).toEqual(HYMNS)

    const folders = (await (await api.get('/api/music/folders')).json())
      .data as { name: string; fileCount: number }[]
    expect(folders.map(({ name, fileCount }) => ({ name, fileCount }))).toEqual(
      [{ name: 'Sample Hymns', fileCount: 3 }],
    )

    const files = (await (await api.get('/api/music/files')).json())
      .data as MusicFile[]
    for (const file of files) expect(file.duration).toBeGreaterThan(50)
  })

  test('an install with the old sample clip gets the hymns instead', async () => {
    await server.stop()
    const db = new DatabaseSync(server.databasePath)
    try {
      const folder = db.prepare('SELECT id, path FROM music_folders').get() as {
        id: number
        path: string
      }
      db.prepare('DELETE FROM music_files').run()
      db.prepare(
        `INSERT INTO music_files (folder_id, path, filename, title, format)
         VALUES (?, ?, 'sample.mp3', 'Sample Audio', 'mp3')`,
      ).run(folder.id, `${folder.path}/sample.mp3`)
    } finally {
      db.close()
    }
    await server.start()
    const api = await server.adminRequest()

    await expect.poll(() => libraryTitles(api)).toEqual(HYMNS)
  })

  test('the music page lists the hymns', async ({ page }) => {
    await page.goto('/music')
    await page.getByText('Sample Hymns', { exact: true }).click()
    for (const hymn of HYMNS) {
      await expect(page.getByText(hymn, { exact: true }).first()).toBeVisible()
    }
  })
})
