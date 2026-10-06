import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'
import JSZip from 'jszip'

import { FakeS3 } from './helpers/fake-s3'
import {
  deleteCategoriesNamed,
  setAutoUpdate,
} from './helpers/song-folder-source'

/**
 * Song sources: the built-in configs, a category shared through the user's
 * own S3 bucket (one object per song, only changes uploaded), adding that
 * share link as a source and importing its songs in Song discovery, and a
 * category exported as a .chsongs file and opened again.
 */

const ts = Date.now()
const categoryName = `E2E Shared ${ts}`
const titles = [`Shared Song A ${ts}`, `Shared Song B ${ts}`]

async function createSong(
  request: APIRequestContext,
  title: string,
  categoryId: number,
): Promise<number> {
  const res = await request.post('/api/songs', {
    data: {
      title,
      categoryId,
      slides: [{ content: `<p>${title} verse</p>`, sortOrder: 0 }],
    },
  })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).data.id
}

/** Drops a file on the page the way a user drags one in. */
async function dropFile(page: Page, bytes: Buffer, name: string) {
  await page.evaluate(
    ({ base64, fileName }) => {
      const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const transfer = new DataTransfer()
      transfer.items.add(new File([data], fileName))
      document.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }),
      )
    },
    { base64: bytes.toString('base64'), fileName: name },
  )
}

test.describe('Song sources', () => {
  test.describe.configure({ mode: 'serial' })

  const s3 = new FakeS3()
  let categoryId: number
  let songIds: number[] = []
  let publicationId: number | undefined
  let linkSourceId: string | undefined

  test.beforeAll(async ({ request }) => {
    await s3.start()
    const res = await request.post('/api/categories', {
      data: { name: categoryName },
    })
    expect(res.ok()).toBeTruthy()
    categoryId = (await res.json()).data.id
    songIds = [
      await createSong(request, titles[0], categoryId),
      await createSong(request, titles[1], categoryId),
    ]
  })

  test.afterAll(async ({ request }) => {
    // Its own category with its songs, and the one the shared link's import
    // made: first, so nothing below can skip it.
    await deleteCategoriesNamed(request, [categoryName])
    await setAutoUpdate(request, true)
    if (linkSourceId) await request.delete(`/api/song-sources/${linkSourceId}`)
    if (publicationId) {
      await request.delete(`/api/song-sources/publications/${publicationId}`)
    }
    const search = await request.get(
      `/api/songs/search?q=${encodeURIComponent(`Shared Song ${ts}`)}`,
    )
    for (const hit of ((await search.json()).data ?? []) as { id: number }[]) {
      await request.delete(`/api/songs/${hit.id}`)
    }
    for (const id of songIds) await request.delete(`/api/songs/${id}`)
    await s3.stop()
  })

  test('the built-in sources come from their config files', async ({
    request,
  }) => {
    const sources = (await (await request.get('/api/song-sources')).json())
      .data as { id: string; format: string; origin: string }[]
    const builtIn = Object.fromEntries(
      sources
        .filter((s) => s.origin === 'built-in')
        .map((s) => [s.id, s.format]),
    )
    expect(builtIn).toEqual({
      'resurse-crestine': 'song-bundle-file',
      'bcev-baicoi': 'song-bundle-file',
      'laudele-domnului': 'cantaricrestine-api',
      'pe-drumul-credintei': 'cantaricrestine-api',
    })
  })

  test('shares a category through S3 and keeps it in sync song by song', async ({
    page,
    request,
  }) => {
    await page.goto('/settings/songs')
    await page.getByLabel(/S3 endpoint|Endpoint S3/).fill(s3.endpoint)
    await page.getByLabel(/^(Bucket)$/).fill('church')
    await page.getByLabel(/Folder in the bucket|Folder în bucket/).fill('e2e')
    await page.getByLabel(/^(Access key|Cheie de acces)$/).fill('AKIAE2E')
    await page.getByLabel(/^(Secret key|Cheie secretă)$/).fill('e2e-secret')
    await page
      .getByLabel(/Public URL of the bucket|URL-ul public al bucketului/)
      .fill(`${s3.endpoint}/church`)
    await page
      .getByRole('button', { name: /Save storage|Salvează setările S3/ })
      .click()

    // The secret stays on the server.
    await expect(async () => {
      const storage = (
        await (await request.get('/api/song-sources/storage')).json()
      ).data
      expect(storage.hasSecret).toBe(true)
      expect(JSON.stringify(storage)).not.toContain('e2e-secret')
    }).toPass()

    await page
      .locator('#song-source-publish-category')
      .selectOption({ label: categoryName })
    await page.getByRole('button', { name: /^(Share|Distribuie)$/ }).click()
    const row = page
      .getByTestId('song-source-publication')
      .filter({ hasText: categoryName })
    await expect(row).toContainText(/2 songs|2 cântări/)

    const manifest = JSON.parse(
      s3.text('/church/e2e/' + slug() + '/manifest.json') ?? '{}',
    )
    expect(
      manifest.songs.map((s: { title: string }) => s.title).sort(),
    ).toEqual([...titles].sort())
    const shareUrl = (await row.locator('p.font-mono').innerText()).trim()
    expect(shareUrl).toBe(`${s3.endpoint}/church/e2e/${slug()}/manifest.json`)

    // Editing one song uploads only that song, then the manifest.
    await request.post('/api/songs', {
      data: {
        id: songIds[0],
        title: titles[0],
        categoryId,
        slides: [{ content: `<p>${titles[0]} changed</p>`, sortOrder: 0 }],
      },
    })
    s3.requests.length = 0
    const publications = (
      await (await request.get('/api/song-sources/publications')).json()
    ).data as { id: number; categoryId: number }[]
    publicationId = publications.find((p) => p.categoryId === categoryId)?.id
    await request.post(`/api/song-sources/publications/${publicationId}/sync`)
    expect(s3.requests.filter((r) => r.startsWith('PUT'))).toHaveLength(2)
    expect(s3.requests.some((r) => r.endsWith('/manifest.json'))).toBe(true)

    // Nothing changed: nothing is sent.
    s3.requests.length = 0
    await request.post(`/api/song-sources/publications/${publicationId}/sync`)
    expect(s3.requests).toHaveLength(0)
  })

  test('a shared link becomes a source whose songs import in Song discovery', async ({
    page,
    request,
  }) => {
    // Someone else's library lacks these songs: remove them here first.
    for (const id of songIds) await request.delete(`/api/songs/${id}`)
    songIds = []
    // Reviewed in Song discovery here, not added on their own.
    await setAutoUpdate(request, false)

    await page.goto('/settings/songs')
    await page
      .getByPlaceholder('https://…/manifest.json')
      .fill(`${s3.endpoint}/church/e2e/${slug()}/manifest.json`)
    await page.getByRole('button', { name: /Add source|Adaugă sursa/ }).click()
    await expect(
      page.getByText(`${s3.endpoint}/church/e2e/${slug()}/manifest.json`),
    ).toBeVisible()

    const sources = (await (await request.get('/api/song-sources')).json())
      .data as { id: string; origin: string; name: string }[]
    linkSourceId = sources.find(
      (s) => s.origin === 'link' && s.name === categoryName,
    )?.id
    expect(linkSourceId).toBeTruthy()

    // Its checksum (from the manifest) tells the app cheaply when to sync.
    const manifestChecksum = JSON.parse(
      s3.text(`/church/e2e/${slug()}/manifest.json`) ?? '{}',
    ).checksum
    expect(manifestChecksum).toBeTruthy()
    const checksum = await request.get(
      `/api/song-sources/${linkSourceId}/checksum`,
    )
    expect((await checksum.json()).data.checksum).toBe(manifestChecksum)

    // Adding it checked it: Song discovery has its songs, all ticked.
    await page.goto(`/songs/discover?source=${linkSourceId}`)
    await expect(
      page.getByRole('checkbox', { name: categoryName, exact: true }),
    ).toBeChecked()
    for (const title of titles) {
      await expect(
        page.getByRole('checkbox', { name: new RegExp(title) }),
      ).toBeChecked({ timeout: 30_000 })
    }
    await page.getByRole('button', { name: /^(Import|Importă)/ }).click()

    await expect(async () => {
      const search = await request.get(
        `/api/songs/search?q=${encodeURIComponent(titles[1])}`,
      )
      const hits = (await search.json()).data as { title: string }[]
      expect(hits.some((h) => h.title === titles[1])).toBe(true)
    }).toPass({ timeout: 15_000 })
  })

  test('a .chsongs file exports a category and opens in Song discovery', async ({
    page,
    request,
  }) => {
    const res = await request.get(
      `/api/song-sources/export?categoryId=${categoryId}`,
    )
    expect(res.ok()).toBeTruthy()
    expect(res.headers()['content-disposition']).toContain('.chsongs')
    const file = await res.body()

    // Inside: one OpenSong file per song, named after it, plus the manifest.
    const zip = await JSZip.loadAsync(file)
    expect(Object.keys(zip.files).sort()).toEqual(
      ['manifest.json', ...titles.map((t) => `${t}.opensong`)].sort(),
    )
    const xml = (await zip.file(`${titles[1]}.opensong`)?.async('string')) ?? ''
    expect(xml).toContain(`<title>${titles[1]}</title>`)
    expect(xml).toContain('<lyrics>')

    // The same bytes as a plain .zip, for other programs.
    const asZip = await request.get(
      `/api/song-sources/export?categoryId=${categoryId}&format=zip`,
    )
    expect(asZip.headers()['content-disposition']).toMatch(/\.zip$/)

    // Opened somewhere these songs are missing.
    const search = await request.get(
      `/api/songs/search?q=${encodeURIComponent(`Shared Song`)}`,
    )
    for (const hit of (await search.json()).data as {
      id: number
      title: string
    }[]) {
      if (hit.title.endsWith(String(ts)))
        await request.delete(`/api/songs/${hit.id}`)
    }

    await page.goto('/songs')
    await dropFile(page, file, `${categoryName}.chsongs`)
    await expect(page).toHaveURL(/\/songs\/discover\?source=file-/)
    // Only the opened file is ticked; its songs are ready to import.
    await expect(
      page.getByRole('checkbox', { name: 'Resurse Creștine', exact: true }),
    ).not.toBeChecked()
    await expect(
      page.getByRole('checkbox', { name: new RegExp(titles[0]) }),
    ).toBeChecked({ timeout: 30_000 })
  })

  test('a link named like a built-in source is told apart in the list', async ({
    page,
    request,
  }) => {
    s3.objects.set(
      '/church/twin/manifest.json',
      Buffer.from(
        JSON.stringify({
          format: 'church-hub-song-bundle',
          version: 1,
          name: 'Laudele Domnului',
          categoryName: 'Laudele Domnului',
          updatedAt: new Date().toISOString(),
          songs: [],
        }),
      ),
    )
    const added = await request.post('/api/song-sources', {
      data: { url: `${s3.endpoint}/church/twin/manifest.json` },
    })
    expect(added.ok()).toBeTruthy()
    const twinId = (await added.json()).data.id as string

    try {
      await page.goto(`/songs/discover?source=${twinId}`)
      const host = new URL(s3.endpoint).host
      await expect(
        page.getByRole('checkbox', { name: `Laudele Domnului ${host}` }),
      ).toBeChecked()
      await expect(
        page.getByRole('checkbox', { name: 'Laudele Domnului', exact: true }),
      ).not.toBeChecked()
    } finally {
      await request.delete(`/api/song-sources/${twinId}`)
      s3.objects.delete('/church/twin/manifest.json')
    }
  })

  test('stopping sharing takes the files off the bucket', async ({
    request,
  }) => {
    expect(s3.objects.size).toBeGreaterThan(0)
    await request.delete(`/api/song-sources/publications/${publicationId}`)
    publicationId = undefined
    expect(s3.objects.size).toBe(0)
  })
})

/** The category's folder name in the bucket. */
function slug(): string {
  return categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}
