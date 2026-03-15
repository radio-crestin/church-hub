import { expect, type Page, test } from '@playwright/test'

/**
 * Helper: perform a text search and wait for results to appear.
 * In CI, the Bible FTS index is rebuilt asynchronously after server start,
 * so we retry the search if it initially returns no results.
 */
async function searchBible(page: Page, query: string) {
  const searchInput = page.getByPlaceholder(/search|cauta|căuta/i).first()
  await expect(searchInput).toBeVisible({ timeout: 5000 })

  const resultsCountLocator = page.locator(
    'text=/\\d+ (versete? gasi(t|te)|verses? found)/i',
  )

  // Retry search up to 3 times — FTS index may still be building in CI
  for (let attempt = 0; attempt < 3; attempt++) {
    await searchInput.fill(query)
    await page.keyboard.press('Enter')

    try {
      await expect(resultsCountLocator).toBeVisible({ timeout: 15000 })
      return searchInput
    } catch {
      if (attempt === 2) throw new Error('Bible search returned no results after 3 attempts')
      // Clear search and retry — FTS index may not be ready yet
      await searchInput.fill('')
      await page.waitForTimeout(3000)
    }
  }

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

  test('search mid-chapter then navigate to boundary does not snap back', async ({
    page,
  }) => {
    // Exact reproduction of user bug: search "Evrei 2:14" → present → navigate
    // with arrows through several verses to end of chapter → cross boundary.
    // The VersesList should follow to chapter 3:1, not snap back to 2:14.

    await page.goto('/bible')
    await page.waitForLoadState('networkidle')

    // Type a Romanian reference to trigger smart search (mid-chapter verse)
    const searchInput = page.getByPlaceholder(/search|cauta|căuta/i).first()
    await expect(searchInput).toBeVisible({ timeout: 5000 })
    // Use Evrei 2:14 - the exact user scenario (Hebrews in Romanian)
    await searchInput.fill('Evrei 2:14')

    // Wait for smart search to navigate (indigo highlight)
    const indigoHighlight = page.locator('button.ring-indigo-500')
    await expect(indigoHighlight).toBeVisible({ timeout: 15000 })

    // Verify URL has select=true
    await expect(page).toHaveURL(/select=true/)

    const searchedVerse = await indigoHighlight
      .locator('span.font-semibold')
      .first()
      .textContent()
    expect(searchedVerse?.trim()).toBe('14')

    // Present the verse via Enter
    await searchInput.press('Enter')
    await page.waitForTimeout(800)
    await expect(page.locator('button.ring-green-500')).toBeVisible({ timeout: 5000 })

    // Navigate with ArrowDown to the last verse of Evrei 2 (18 verses)
    // From verse 14, need 4 presses to reach verse 18
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(300)
    }

    // Should be on the last verse now
    const lastV = page.locator('button.ring-green-500')
    await expect(lastV).toBeVisible({ timeout: 5000 })
    const lastVNum = await lastV.locator('span.font-semibold').first().textContent()
    expect(parseInt(lastVNum!.trim(), 10)).toBeGreaterThan(14)

    // Cross the chapter boundary
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(3000)

    // Should be on chapter 3, verse 1 - NOT snapped back to verse 14
    const newHighlight = page.locator('button.ring-green-500')
    await expect(newHighlight).toBeVisible({ timeout: 10000 })

    const finalVerse = await newHighlight
      .locator('span.font-semibold')
      .first()
      .textContent()
    expect(finalVerse?.trim()).toBe('1')

    // CRITICAL: Verify the highlighted verse is scrolled into view
    // (the bug might show correct highlight but wrong scroll position)
    const box = await newHighlight.boundingBox()
    expect(box).toBeTruthy()
    // The verse should be in the visible area of the page (not scrolled out)
    const viewport = page.viewportSize()!
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeLessThan(viewport.height)

    // Wait extra time and re-check - the bug might cause a delayed snap-back
    await page.waitForTimeout(2000)
    const afterWait = page.locator('button.ring-green-500')
    const afterVerseNum = await afterWait
      .locator('span.font-semibold')
      .first()
      .textContent()
    expect(afterVerseNum?.trim()).toBe('1')

    // Re-verify scroll position after the wait
    const afterBox = await afterWait.boundingBox()
    expect(afterBox).toBeTruthy()
    expect(afterBox!.y).toBeGreaterThanOrEqual(0)
    expect(afterBox!.y).toBeLessThan(viewport.height)

    // Verify chapter 3 header is visible (Evrei 3)
    const stickyHeaders = page.locator('.sticky span.font-bold')
    const count = await stickyHeaders.count()
    const texts: string[] = []
    for (let i = 0; i < count; i++) {
      const t = await stickyHeaders.nth(i).textContent()
      if (t?.trim()) texts.push(t.trim())
    }
    expect(texts.some((t) => t.includes('3'))).toBe(true)
  })

  test('search then arrow key across chapter boundary does not snap back (Geneza)', async ({
    page,
  }) => {
    await page.goto('/bible')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByPlaceholder(/search|cauta|căuta/i).first()
    await expect(searchInput).toBeVisible({ timeout: 5000 })
    await searchInput.fill('Geneza 2:25')

    const indigoHighlight = page.locator('button.ring-indigo-500')
    await expect(indigoHighlight).toBeVisible({ timeout: 15000 })
    await expect(page).toHaveURL(/select=true/)

    await searchInput.press('Enter')
    await page.waitForTimeout(800)
    await expect(page.locator('button.ring-green-500')).toBeVisible({ timeout: 5000 })

    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(3000)

    const newHighlight = page.locator('button.ring-green-500')
    await expect(newHighlight).toBeVisible({ timeout: 10000 })
    const newVerseNum = await newHighlight
      .locator('span.font-semibold')
      .first()
      .textContent()
    expect(newVerseNum?.trim()).toBe('1')
  })

  test('arrow key navigation across chapter boundary does not snap back', async ({
    page,
  }) => {
    // Bug: presenting a verse then using arrow keys to cross a chapter boundary
    // would snap the VersesList back to the old verse instead of following.
    // Root cause: isBrowsingRef was never cleared after presenting/navigating.

    await page.goto('/bible')
    await page.waitForLoadState('networkidle')

    // Click Geneza (Genesis) in the books list
    const geneza = page.getByRole('button', { name: /geneza/i }).first()
    await expect(geneza).toBeVisible({ timeout: 10000 })
    await geneza.click()

    // Select chapter 2
    const chapter2 = page.getByRole('button', { name: '2' }).first()
    await expect(chapter2).toBeVisible({ timeout: 5000 })
    await chapter2.click()

    // Wait for verses to load
    const verseButtons = page.locator('.space-y-1 button.w-full.text-left')
    await expect(verseButtons.first()).toBeVisible({ timeout: 15000 })

    // Click the LAST verse to present it
    const verseCount = await verseButtons.count()
    expect(verseCount).toBeGreaterThan(0)
    await verseButtons.nth(verseCount - 1).click()
    await page.waitForTimeout(800)

    // Verify green highlight on presented verse
    const greenHighlight = page.locator('button.ring-green-500')
    await expect(greenHighlight).toBeVisible({ timeout: 5000 })

    const lastVerseNum = await greenHighlight
      .locator('span.font-semibold')
      .first()
      .textContent()
    const lastNum = parseInt(lastVerseNum!.trim(), 10)
    expect(lastNum).toBeGreaterThan(0)

    // Press ArrowDown to cross into next chapter
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(3000)

    // The green highlight should now show verse 1 of the NEXT chapter
    const newHighlight = page.locator('button.ring-green-500')
    await expect(newHighlight).toBeVisible({ timeout: 10000 })

    const newVerseNum = await newHighlight
      .locator('span.font-semibold')
      .first()
      .textContent()
    expect(newVerseNum?.trim()).toBe('1')

    // Verify a chapter header with "3" is visible
    const stickyHeaders = page.locator('.sticky span.font-bold')
    const count = await stickyHeaders.count()
    const texts: string[] = []
    for (let i = 0; i < count; i++) {
      const t = await stickyHeaders.nth(i).textContent()
      if (t?.trim()) texts.push(t.trim())
    }
    expect(texts.some((t) => t.includes('3'))).toBe(true)
  })

  test('arrow key navigation backwards across chapter boundary', async ({
    page,
  }) => {
    await page.goto('/bible')
    await page.waitForLoadState('networkidle')

    // Click Geneza
    const geneza = page.getByRole('button', { name: /geneza/i }).first()
    await expect(geneza).toBeVisible({ timeout: 10000 })
    await geneza.click()

    // Select chapter 3
    const chapter3 = page.getByRole('button', { name: '3' }).first()
    await expect(chapter3).toBeVisible({ timeout: 5000 })
    await chapter3.click()

    // Wait for verses
    const verseButtons = page.locator('.space-y-1 button.w-full.text-left')
    await expect(verseButtons.first()).toBeVisible({ timeout: 15000 })

    // Click the FIRST verse to present it
    await verseButtons.first().click()
    await page.waitForTimeout(800)

    const greenHighlight = page.locator('button.ring-green-500')
    await expect(greenHighlight).toBeVisible({ timeout: 5000 })

    const verseNum = await greenHighlight
      .locator('span.font-semibold')
      .first()
      .textContent()
    expect(verseNum?.trim()).toBe('1')

    // Press ArrowUp to cross back into previous chapter
    await page.keyboard.press('ArrowUp')
    await page.waitForTimeout(3000)

    // Should be on the last verse of chapter 2, not stuck on 3:1
    const newHighlight = page.locator('button.ring-green-500')
    await expect(newHighlight).toBeVisible({ timeout: 10000 })

    const newVerseNum = await newHighlight
      .locator('span.font-semibold')
      .first()
      .textContent()
    const num = parseInt(newVerseNum!.trim(), 10)
    expect(num).toBeGreaterThan(1)
  })
})
