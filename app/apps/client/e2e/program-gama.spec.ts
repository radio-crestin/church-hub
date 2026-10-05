import { readFile } from 'node:fs/promises'
import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * The gama ("key line") of program songs:
 *  1. T-017 — the saved program file keeps each song's gama.
 *  2. T-022 — the program page and the song page's program list show the gama,
 *     hint at songs without one, and edit it in place; "Edit as text" writes
 *     it between braces and saves a changed one.
 */

interface Fixture {
  scheduleId: number
  withKey: { id: number; title: string }
  withoutKey: { id: number; title: string }
}

async function createFixture(request: APIRequestContext): Promise<Fixture> {
  const uniq = `${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const makeSong = async (title: string, keyLine: string | null) => {
    const res = await request.post('/api/songs', {
      data: { title, keyLine, slides: [{ content: title, sortOrder: 0 }] },
    })
    return (await res.json()).data as { id: number; title: string }
  }
  const withKey = await makeSong(`E2E Gama Re ${uniq}`, 'Re major')
  const withoutKey = await makeSong(`E2E Gama None ${uniq}`, null)
  const res = await request.post('/api/schedules', {
    data: { title: `E2E Gama Program ${uniq}` },
  })
  const scheduleId = (await res.json()).data.id as number
  for (const song of [withKey, withoutKey]) {
    await request.post(`/api/schedules/${scheduleId}/items`, {
      data: { songId: song.id },
    })
  }
  return { scheduleId, withKey, withoutKey }
}

async function removeFixture(request: APIRequestContext, f: Fixture) {
  await request.delete(`/api/schedules/${f.scheduleId}`).catch(() => {})
  await request.delete(`/api/songs/${f.withKey.id}`).catch(() => {})
  await request.delete(`/api/songs/${f.withoutKey.id}`).catch(() => {})
}

async function songKeyLine(request: APIRequestContext, songId: number) {
  const res = await request.get(`/api/songs/${songId}`)
  return (await res.json()).data.keyLine as string | null
}

const programRow = (page: import('@playwright/test').Page, title: string) =>
  page.getByTestId('schedule-item').filter({ hasText: title }).first()

test.describe('Program gama', () => {
  let f: Fixture

  test.beforeEach(async ({ request }) => {
    f = await createFixture(request)
  })

  test.afterEach(async ({ request }) => {
    await removeFixture(request, f)
  })

  test('the saved program file keeps each song gama', async ({ page }) => {
    await page.goto(`/schedules/${f.scheduleId}`)
    await expect(programRow(page, f.withKey.title)).toBeVisible({
      timeout: 15000,
    })
    await page
      .getByRole('button', { name: /Save to File|Salveaza in Fisier/ })
      .click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /^(Export|Exporta)$/ }).click()
    const download = await downloadPromise
    const json = JSON.parse(await readFile(await download.path(), 'utf8'))
    const keys = json.items.map(
      (item: { song: { key: string | null } }) => item.song.key,
    )
    expect(keys).toEqual(['Re major', null])
  })

  test('the program page shows the gama, hints a missing one and edits it', async ({
    page,
    request,
  }) => {
    await page.goto(`/schedules/${f.scheduleId}`)
    const withKeyChip = programRow(page, f.withKey.title).getByTestId(
      'schedule-item-key-line',
    )
    const missingChip = programRow(page, f.withoutKey.title).getByTestId(
      'schedule-item-key-line',
    )
    await expect(withKeyChip).toHaveText('Re major', { timeout: 15000 })
    await expect(missingChip).toHaveAttribute('data-missing', 'true')

    await missingChip.click()
    await page.locator('dialog[open] #keyLine').fill('Sol major')
    await page.locator('dialog[open]').getByTestId('key-line-save').click()

    await expect(missingChip).toHaveText('Sol major')
    await expect(missingChip).not.toHaveAttribute('data-missing', 'true')
    expect(await songKeyLine(request, f.withoutKey.id)).toBe('Sol major')
  })

  test('the song page program list shows and edits the gama', async ({
    page,
    request,
  }) => {
    await page.addInitScript((scheduleId: number) => {
      window.localStorage.setItem('song-detail:schedules-open', 'true')
      window.localStorage.setItem(
        'songPage.selectedScheduleId',
        String(scheduleId),
      )
    }, f.scheduleId)
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto(`/songs/${f.withKey.id}`)

    const rows = page
      .getByTestId('schedule-songs-panel')
      .getByTestId('schedule-song-item')
    const missingChip = rows
      .filter({ hasText: f.withoutKey.title })
      .getByTestId('schedule-song-key-line')
    await expect(
      rows
        .filter({ hasText: f.withKey.title })
        .getByTestId('schedule-song-key-line'),
    ).toHaveText('Re major', { timeout: 15000 })
    await expect(missingChip).toHaveAttribute('data-missing', 'true')

    await missingChip.click()
    await page.locator('dialog[open] #keyLine').fill('La minor')
    await page.locator('dialog[open]').getByTestId('key-line-save').click()

    await expect(missingChip).toHaveText('La minor')
    expect(await songKeyLine(request, f.withoutKey.id)).toBe('La minor')
  })

  test('edit as text writes the gama in braces and saves a changed one', async ({
    page,
    request,
  }) => {
    await page.goto(`/schedules/${f.scheduleId}`)
    await expect(programRow(page, f.withKey.title)).toBeVisible({
      timeout: 15000,
    })
    await page
      .getByRole('button', { name: /Edit as Text|Editeaza ca Text/ })
      .click()
    const textarea = page.locator('dialog[open] textarea')
    const text = await textarea.inputValue()
    expect(text).toContain(`${f.withKey.title} #${f.withKey.id} {Re major}`)
    expect(text).toContain(`${f.withoutKey.title} #${f.withoutKey.id} {}`)

    await textarea.fill(
      text.replace(`#${f.withoutKey.id} {}`, `#${f.withoutKey.id} {Mi major}`),
    )
    await page
      .locator('dialog[open]')
      .getByRole('button', { name: /^(Apply|Aplică|Aplica)/ })
      .click()

    await expect(
      programRow(page, f.withoutKey.title).getByTestId(
        'schedule-item-key-line',
      ),
    ).toHaveText('Mi major', { timeout: 15000 })
    expect(await songKeyLine(request, f.withoutKey.id)).toBe('Mi major')
    expect(await songKeyLine(request, f.withKey.id)).toBe('Re major')

    // Reopened, both the detailed and the plain view carry every gama.
    await page
      .getByRole('button', { name: /Edit as Text|Editeaza ca Text/ })
      .click()
    const reopened = page.locator('dialog[open]')
    expect(await reopened.locator('textarea').inputValue()).toContain(
      `${f.withoutKey.title} #${f.withoutKey.id} {Mi major}`,
    )
    await reopened
      .getByRole('button', { name: /Plain View|Vizualizare Simpla/ })
      .click()
    const plain = reopened.locator('pre')
    await expect(plain).toContainText(`${f.withKey.title} (Re major)`)
    await expect(plain).toContainText(`${f.withoutKey.title} (Mi major)`)
    await expect(plain).not.toContainText('#')
  })
})
