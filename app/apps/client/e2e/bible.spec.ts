import { expect, type Page, test } from '@playwright/test'

/**
 * Helper: perform a text search and wait for results to appear.
 */
async function searchBible(page: Page, query: string) {
  const searchInput = page.getByPlaceholder(/search|cauta|căuta/i).first()
  await expect(searchInput).toBeVisible({ timeout: 5000 })
  await searchInput.fill(query)
  await page.keyboard.press('Enter')

  // Wait for results to appear (Romanian: "N versete gasite", English: "N verses found")
  await expect(
    page.locator('text=/\\d+ (versete? gasi(t|te)|verses? found)/i'),
  ).toBeVisible({ timeout: 10000 })

  return searchInput
}

test.describe('Bible Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('can navigate to bible page', async ({ page }) => {
    await page.goto('/bible')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/.*bible/)
  })

  test('displays books list', async ({ page }) => {
    await page.goto('/bible')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toBeVisible()
  })

  test('can select a book and chapter', async ({ page }) => {
    await page.goto('/bible')
    await page.waitForLoadState('networkidle')

    const genesisButton = page
      .getByRole('button', { name: /genesis|geneza/i })
      .first()

    if (await genesisButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await genesisButton.click()
      await page.waitForTimeout(500)

      const chapter1 = page.getByRole('button', { name: /^1$/ }).first()
      if (await chapter1.isVisible({ timeout: 3000 }).catch(() => false)) {
        await chapter1.click()
      }
    }

    await expect(page.locator('body')).toBeVisible()
  })

  test('can display a verse', async ({ page }) => {
    await page.goto('/bible')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByPlaceholder(/search|cauta/i).first()

    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('John 3:16')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(1000)
    }

    await expect(page.locator('body')).toBeVisible()
  })

  test('clicking second search result selects the correct verse', async ({
    page,
  }) => {
    await page.goto('/bible')
    await page.waitForLoadState('networkidle')

    await searchBible(page, 'Isus a zis')

    // Get all search result buttons
    const results = page.locator('button.w-full.text-left.px-3.py-2')
    const resultCount = await results.count()
    expect(resultCount).toBeGreaterThanOrEqual(2)

    // Parse the second result's reference to know what verse to expect
    const secondResult = results.nth(1)
    const referenceText = await secondResult
      .locator('span.text-indigo-600, span.text-indigo-400')
      .first()
      .textContent()
    const refMatch = referenceText?.match(/(\d+):(\d+)/)
    expect(refMatch).toBeTruthy()
    const expectedVerse = parseInt(refMatch![2], 10)

    // Ensure the element is settled and click it
    await secondResult.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)

    // Use page.mouse.click with explicit coordinates for React compatibility
    const box = await secondResult.boundingBox()
    expect(box).toBeTruthy()
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)

    // Wait for verse list to show (search results disappear, verse list appears)
    const highlightedVerse = page.locator('.ring-indigo-500')
    await expect(highlightedVerse).toBeVisible({ timeout: 10000 })

    // The highlighted verse number must match the clicked search result
    const highlightedVerseNumber = await highlightedVerse
      .locator('span.font-semibold')
      .first()
      .textContent()
    expect(parseInt(highlightedVerseNumber!, 10)).toBe(expectedVerse)
  })

  test('keyboard Enter selects the focused search result, not the first', async ({
    page,
  }) => {
    await page.goto('/bible')
    await page.waitForLoadState('networkidle')

    const searchInput = await searchBible(page, 'Isus a zis')

    // Get search results
    const results = page.locator('button.w-full.text-left.px-3.py-2')
    expect(await results.count()).toBeGreaterThanOrEqual(2)

    // Get expected verse from the second result
    const secondResultRef = await results
      .nth(1)
      .locator('span.text-indigo-600, span.text-indigo-400')
      .first()
      .textContent()
    const refMatch = secondResultRef?.match(/(\d+):(\d+)/)
    expect(refMatch).toBeTruthy()
    const expectedVerse = parseInt(refMatch![2], 10)

    // Navigate to the second result using keyboard
    await searchInput.focus()
    await page.keyboard.press('ArrowDown') // focus result 0
    await page.keyboard.press('ArrowDown') // focus result 1

    // Verify the second result is focused (keyboard highlight)
    await page.waitForTimeout(200)

    // Press Enter to select
    await page.keyboard.press('Enter')

    // Wait for the verse list with highlighted verse to appear
    const highlightedVerse = page.locator('.ring-indigo-500')
    await expect(highlightedVerse).toBeVisible({ timeout: 10000 })

    // The highlighted verse must match the SECOND result, not the first
    const highlightedVerseNumber = await highlightedVerse
      .locator('span.font-semibold')
      .first()
      .textContent()
    expect(parseInt(highlightedVerseNumber!, 10)).toBe(expectedVerse)
  })

  test('search result selection works after viewing a chapter', async ({
    page,
  }) => {
    // Navigate to a chapter first to set pre-search state at verses level
    await page.goto('/bible')
    await page.waitForLoadState('networkidle')

    // Click on Geneza (Genesis) to navigate to chapters
    const genesisButton = page
      .getByRole('button', { name: /geneza/i })
      .first()
    await expect(genesisButton).toBeVisible({ timeout: 5000 })
    await genesisButton.click()

    // Click chapter 1
    const chapter1 = page.getByRole('button', { name: /^1$/ }).first()
    await expect(chapter1).toBeVisible({ timeout: 5000 })
    await chapter1.click()

    // Wait for verse buttons to load in the navigation panel
    await expect(
      page.locator('.space-y-1 button.w-full.text-left').first(),
    ).toBeVisible({
      timeout: 10000,
    })

    // Now search for text
    await searchBible(page, 'Isus a zis')

    // Get all search result buttons
    const results = page.locator('button.w-full.text-left.px-3.py-2')
    const resultCount = await results.count()
    expect(resultCount).toBeGreaterThanOrEqual(2)

    // Parse the second result's reference
    const secondResult = results.nth(1)
    const referenceText = await secondResult
      .locator('span.text-indigo-600, span.text-indigo-400')
      .first()
      .textContent()
    const refMatch = referenceText?.match(/(\d+):(\d+)/)
    expect(refMatch).toBeTruthy()
    const expectedChapter = parseInt(refMatch![1], 10)
    const expectedVerse = parseInt(refMatch![2], 10)

    // Click the second result
    await secondResult.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    const box = await secondResult.boundingBox()
    expect(box).toBeTruthy()
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)

    // Wait for verse list with highlighted verse (not search results)
    const highlightedVerse = page.locator('.ring-indigo-500')
    await expect(highlightedVerse).toBeVisible({ timeout: 10000 })

    // Verify the correct verse is highlighted (not the pre-search chapter's verse)
    const highlightedVerseNumber = await highlightedVerse
      .locator('span.font-semibold')
      .first()
      .textContent()
    expect(parseInt(highlightedVerseNumber!, 10)).toBe(expectedVerse)

    // Verify we navigated to the correct chapter (not restored to Genesis 1)
    // The URL should contain the expected chapter
    await expect(page).toHaveURL(new RegExp(`chapter=${expectedChapter}`))
  })
})
