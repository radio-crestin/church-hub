import { expect, type Page, test } from '@playwright/test'

/**
 * Bible and song search find a text from any part of it, typed with typos,
 * without diacritics or in the old orthography, with the closest match
 * first (T-128: one shared search engine for both).
 */

const JOHN_3_16 = /Ioan 3:16/

async function firstBibleResult(page: Page, query: string) {
  const searchInput = page.getByPlaceholder(/search|cauta|căuta/i).first()
  await searchInput.fill(query)
  await page.keyboard.press('Enter')
  const first = page.locator('button.w-full.text-left.px-3.py-2').first()
  await expect(first).toBeVisible({ timeout: 15000 })
  return first.locator('span.text-indigo-600, span.text-indigo-400').first()
}

test.describe('Typo-tolerant Bible search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bible')
    await page.waitForLoadState('networkidle')
  })

  for (const [kind, query] of [
    ['a fragment from the middle', 'singurul Lui Fiu pentru ca oricine'],
    ['a typo in two words', 'atat de mult a iubti Dumnezue lumea'],
    ['no diacritics', 'fiindca atat de mult a iubit'],
    ['the old orthography', 'Fiindcă atît de mult a iubit'],
  ] as const) {
    test(`${kind} finds the verse first`, async ({ page }) => {
      await expect(await firstBibleResult(page, query)).toHaveText(JOHN_3_16)
    })
  }
})

test.describe('Typo-tolerant song search', () => {
  test('a typed fragment with typos finds the song first', async ({
    page,
    request,
  }) => {
    const uniq = String(Date.now())
    const title = `Cetatea zorilor ${uniq}`
    const created = await request.post('/api/songs', {
      data: {
        title,
        slides: [
          {
            content:
              '<p>Departe peste munţii Hermonului strălucește cetatea Zorilandei</p>',
            sortOrder: 0,
          },
        ],
      },
    })
    expect(created.status()).toBe(201)
    const songId = (await created.json()).data.id as number

    try {
      await page.goto('/songs')
      const search = page.getByPlaceholder(/search songs|caută cântări/i)
      const firstTitle = page.getByTestId('song-card-title').first()

      await search.fill('muntii Hermonlui straluceste cetatea Zorilandie')
      await expect(firstTitle).toHaveText(title)

      await search.fill('peste munţii Hermon')
      await expect(firstTitle).toHaveText(title)
    } finally {
      await request.delete(`/api/songs/${songId}`).catch(() => {})
    }
  })
})
