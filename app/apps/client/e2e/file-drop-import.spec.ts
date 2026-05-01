import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(currentDir, 'fixtures')
const PPTX_FILE = path.join(FIXTURES_DIR, 'Cand Isus Hristos m-a mantuit.pptx')
const PPT_FILE = path.join(FIXTURES_DIR, 'Se cuvine.ppt')

/**
 * Delete all songs matching a title substring via the API.
 */
async function deleteMatchingSongs(
  request: import('@playwright/test').APIRequestContext,
  titleSubstring: string,
) {
  const resp = await request.get('/api/songs')
  const json = await resp.json()
  for (const song of json.data ?? []) {
    if (
      (song.title as string)
        .toLowerCase()
        .includes(titleSubstring.toLowerCase())
    ) {
      await request.delete(`/api/songs/${song.id}`)
    }
  }
}

/**
 * Simulates a file drop on the document by injecting file bytes into a
 * synthetic DragEvent. Chromium's DataTransfer constructor supports
 * `items.add(file)`, so the handler sees `e.dataTransfer.files`.
 */
async function simulateFileDrop(
  page: import('@playwright/test').Page,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
) {
  const base64Data = fileBuffer.toString('base64')

  await page.evaluate(
    ({ base64, name, mime }) => {
      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const file = new File([bytes], name, { type: mime })
      const dt = new DataTransfer()
      dt.items.add(file)

      document.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
        }),
      )
    },
    { base64: base64Data, name: fileName, mime: mimeType },
  )
}

test.describe('File Drop Import', () => {
  test('can import a .pptx file via drag and drop', async ({ page }) => {
    // Clean up any existing song with the same title first
    await deleteMatchingSongs(page.request, 'Isus Hristos')
    await deleteMatchingSongs(page.request, 'mantuit')

    await page.goto('/songs')
    await page.waitForLoadState('networkidle')

    const fileBuffer = fs.readFileSync(PPTX_FILE)

    // Listen for the POST /api/songs response that creates the song
    const songCreatedPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/songs') &&
        !resp.url().includes('/search') &&
        resp.request().method() === 'POST' &&
        (resp.status() === 200 || resp.status() === 201),
      { timeout: 15000 },
    )

    await simulateFileDrop(
      page,
      fileBuffer,
      'Cand Isus Hristos m-a mantuit.pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    )

    const response = await songCreatedPromise
    const json = await response.json()

    expect(json).toHaveProperty('data')
    expect(json.data).toHaveProperty('id')
    expect(json.data.slides.length).toBeGreaterThan(0)

    // Should navigate to the song detail page
    await page.waitForURL(/\/songs\/\d+/, { timeout: 10000 })

    // Clean up the created song
    await page.request.delete(`/api/songs/${json.data.id}`)
  })

  test('can import a .ppt file via drag and drop', async ({ page }) => {
    // PPT (1997-2003 binary format) parsing is significantly slower than
    // PPTX — especially on CI runners — so the per-test 30s default is too
    // tight. waitForResponse below allows 60s, the page navigation needs
    // another ~15s, plus setup. Allow 120s overall.
    test.setTimeout(120_000)

    // Clean up any existing song with the same title
    await deleteMatchingSongs(page.request, 'Se cuvine')

    await page.goto('/songs')
    await page.waitForLoadState('networkidle')

    const fileBuffer = fs.readFileSync(PPT_FILE)

    // PPT conversion takes longer
    const songCreatedPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/songs') &&
        !resp.url().includes('/search') &&
        resp.request().method() === 'POST' &&
        (resp.status() === 200 || resp.status() === 201),
      { timeout: 60000 },
    )

    await simulateFileDrop(
      page,
      fileBuffer,
      'Se cuvine.ppt',
      'application/vnd.ms-powerpoint',
    )

    const response = await songCreatedPromise
    const json = await response.json()

    expect(json).toHaveProperty('data')
    expect(json.data).toHaveProperty('id')
    expect(json.data.slides.length).toBeGreaterThan(0)

    // Should navigate to the song detail page
    await page.waitForURL(/\/songs\/\d+/, { timeout: 15000 })

    // Clean up the created song
    await page.request.delete(`/api/songs/${json.data.id}`)
  })
})
