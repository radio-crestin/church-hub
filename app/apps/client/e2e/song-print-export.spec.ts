import { readFile } from 'node:fs/promises'
import { expect, type Page, test } from '@playwright/test'

import { selectAction } from './helpers/actions-menu'

/**
 * Song page: "Export as PDF" and "Export as Word" in the actions menu each
 * download a print-ready A4 file with the title, then every section label and
 * its lyrics. Romanian diacritics must survive.
 */
test.describe('Song print export', () => {
  const title = `Măreț ești, Doamne ${Date.now()}`
  let songId: number

  test.beforeAll(async ({ request }) => {
    const res = await request.post('/api/songs', {
      data: {
        title,
        slides: [
          { content: 'Prima strofă\ncu ăîșț', label: 'V1', sortOrder: 0 },
          { content: 'Aleluia, Aleluia', label: 'C1', sortOrder: 1 },
        ],
      },
    })
    songId = (await res.json()).data.id
  })

  test.afterAll(async ({ request }) => {
    await request.delete(`/api/songs/${songId}`)
  })

  async function downloadFrom(page: Page, itemTestId: string) {
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto(`/songs/${songId}`)
    const downloadPromise = page.waitForEvent('download')
    await selectAction(page, 'song-actions-menu', itemTestId)
    const download = await downloadPromise
    return {
      filename: download.suggestedFilename(),
      bytes: await readFile(await download.path()),
    }
  }

  test('exports the song as a PDF', async ({ page }) => {
    const { filename, bytes } = await downloadFrom(page, 'song-export-pdf')

    expect(filename).toMatch(/\.pdf$/)
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
    // A4 is 595 x 842 points
    expect(bytes.toString('latin1')).toMatch(
      /MediaBox\s*\[\s*0\s+0\s+595\.\d+\s+841\.\d+/,
    )
  })

  test('exports the song as a Word document', async ({ page }) => {
    const { filename, bytes } = await downloadFrom(page, 'song-export-docx')

    expect(filename).toMatch(/\.docx$/)
    expect(bytes.subarray(0, 2).toString()).toBe('PK')

    const { default: JSZip } = await import('jszip')
    const zip = await JSZip.loadAsync(bytes)
    const xml = await zip.file('word/document.xml')?.async('string')
    expect(xml).toContain('Măreț ești, Doamne')
    expect(xml).toContain('V1')
    expect(xml).toContain('Prima strofă')
    expect(xml).toContain('ăîșț')
    expect(xml).toContain('Aleluia, Aleluia')
  })
})
