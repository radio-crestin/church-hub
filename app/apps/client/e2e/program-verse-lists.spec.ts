import { type APIRequestContext, expect, test } from '@playwright/test'

/**
 * Program readings accept comma verse lists (T-015): "Ioan 3:16,17" reads as
 * 3:16-17, and "Ioan 3:16-18,20" keeps its gap — verse 19 is not read.
 */

interface Reading {
  personName: string
  reference: string
  text: string
  startVerse: number
  endVerse: number
}

async function createProgram(request: APIRequestContext): Promise<number> {
  const res = await request.post('/api/schedules', {
    data: { title: `E2E Verse lists ${Date.now()}` },
  })
  return (await res.json()).data.id
}

async function readReadings(
  request: APIRequestContext,
  scheduleId: number,
): Promise<Reading[]> {
  const res = await request.get(`/api/schedules/${scheduleId}`)
  const { data } = await res.json()
  return data.items.flatMap(
    (item: { verseteTineriEntries?: Reading[] }) =>
      item.verseteTineriEntries ?? [],
  )
}

async function firstTranslationId(request: APIRequestContext) {
  const res = await request.get('/api/bible/translations')
  const translation = (await res.json()).data?.[0]
  expect(translation).toBeTruthy()
  return translation.id as number
}

test.describe('program readings accept comma verse lists', () => {
  test('the API stores a list with a gap without the verses in the gap', async ({
    request,
  }) => {
    const scheduleId = await createProgram(request)
    try {
      const translationId = await firstTranslationId(request)
      const ioan3 = (startVerse: number, endVerse: number) => ({
        personName: 'Ana',
        translationId,
        bookCode: 'JHN',
        bookName: 'Ioan',
        startChapter: 3,
        startVerse,
        endChapter: 3,
        endVerse,
      })
      const res = await request.post(`/api/schedules/${scheduleId}/items`, {
        data: {
          slideType: 'versete_tineri',
          verseteTineriEntries: [
            {
              ...ioan3(16, 20),
              verseSegments: [
                { startVerse: 16, endVerse: 18 },
                { startVerse: 20, endVerse: 20 },
              ],
            },
            ioan3(16, 18),
            ioan3(19, 19),
            ioan3(20, 20),
          ],
        },
      })
      expect(res.status()).toBe(201)

      const [list, before, gap, after] = await readReadings(request, scheduleId)
      expect(list.reference).toBe('Ioan 3:16-18,20')
      expect(list.startVerse).toBe(16)
      expect(list.endVerse).toBe(20)
      expect(list.text).toBe(`${before.text} ${after.text}`)
      expect(list.text).not.toContain(gap.text)
    } finally {
      await request.delete(`/api/schedules/${scheduleId}`).catch(() => {})
    }
  })

  test('typing "Ioan 3:16,17" and "Ioan 3:16-18,20" adds both readings, and editing keeps the gap', async ({
    page,
    request,
  }) => {
    const scheduleId = await createProgram(request)
    try {
      await page.setViewportSize({ width: 1400, height: 900 })
      await page.goto(`/schedules/${scheduleId}`)
      await page.waitForLoadState('networkidle')

      await page.getByTestId('schedule-add-item').click()
      await page.getByTestId('add-schedule-item-verseteTineri').click()
      const modal = page.getByTestId('insert-slide-modal')
      await expect(modal).toBeVisible()

      const addEntry = modal.getByRole('button', {
        name: /Adauga Intrare|Add Entry/,
      })
      const names = modal.getByPlaceholder(/Nume persoana|Person name/)
      const references = modal.getByPlaceholder(/Gen 1:1/)

      await addEntry.click()
      await names.nth(0).fill('Timeea')
      await references.nth(0).fill('Ioan 3:16,17')
      await expect(
        modal.getByText('Ioan 3:16-17', { exact: true }),
      ).toBeVisible()

      await addEntry.click()
      await names.nth(1).fill('Tibi')
      await references.nth(1).fill('Ioan 3:16-18,20')
      await expect(
        modal.getByText('Ioan 3:16-18,20', { exact: true }),
      ).toBeVisible()

      await modal.getByTestId('insert-slide-save').click()
      await expect(modal).toBeHidden()

      await expect
        .poll(async () =>
          (await readReadings(request, scheduleId)).map((r) => r.reference),
        )
        .toEqual(['Ioan 3:16-17', 'Ioan 3:16-18,20'])

      // The add-item chooser stays open for the next item; close it.
      const chooser = page.getByTestId('add-schedule-item-modal')
      if (await chooser.isVisible()) await page.keyboard.press('Escape')
      await expect(chooser).toBeHidden()

      // Edit the item and change only a name: the list must keep its gap.
      await page.getByText('Timeea', { exact: false }).first().click({
        button: 'right',
      })
      await page
        .getByText(/^(Editeaza|Edit)$/)
        .first()
        .click()
      await expect(modal).toBeVisible()
      await expect(
        modal.getByText('Ioan 3:16-18,20', { exact: true }),
      ).toBeVisible()
      await names.nth(1).fill('Tibi B')
      await modal.getByTestId('insert-slide-save').click()
      await expect(modal).toBeHidden()

      await expect
        .poll(async () =>
          (await readReadings(request, scheduleId)).map(
            (r) => `${r.personName}: ${r.reference}`,
          ),
        )
        .toEqual(['Timeea: Ioan 3:16-17', 'Tibi B: Ioan 3:16-18,20'])
    } finally {
      await request.delete(`/api/schedules/${scheduleId}`).catch(() => {})
    }
  })
})
