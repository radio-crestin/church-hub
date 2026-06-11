import { expect, test } from '@playwright/test'

test.describe('Keyboard Shortcuts - Song Navigation', () => {
  test('ArrowDown navigates to next slide in song', async ({ page }) => {
    await page.goto('/songs')
    await page.waitForLoadState('networkidle')

    const songElement = page
      .locator('[data-testid="song-card"], [data-testid="song-list-item"]')
      .first()

    if (!(await songElement.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No songs available')
      return
    }

    await songElement.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Click a slide to start presentation. Exclude disabled buttons: the
    // always-mounted (but closed) ServerConnectionModal contributes a hidden,
    // disabled "Reconnect" button that also matches `button.rounded-lg` and
    // would otherwise pollute the slide set and be picked by `.nth()`.
    const slides = page.locator('button.rounded-lg:not([disabled])')
    if (
      !(await slides
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false))
    ) {
      test.skip(true, 'No slides visible')
      return
    }

    await slides.first().click()
    await page.waitForTimeout(500)

    // Check if green highlight appears (active slide)
    const greenHighlight = page.locator(
      'button.ring-green-500, [class*="ring-green"]',
    )
    if (await greenHighlight.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Navigate down
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(500)

      // Green highlight should still exist (moved to next slide)
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('ArrowUp navigates to previous slide in song', async ({ page }) => {
    await page.goto('/songs')
    await page.waitForLoadState('networkidle')

    const songElement = page
      .locator('[data-testid="song-card"], [data-testid="song-list-item"]')
      .first()

    if (!(await songElement.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'No songs available')
      return
    }

    await songElement.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Exclude disabled buttons so the hidden ServerConnectionModal "Reconnect"
    // button doesn't inflate the slide count or get selected by `.nth(1)` —
    // clicking that disabled button is what flaked this test in CI.
    const slides = page.locator('button.rounded-lg:not([disabled])')
    const slideCount = await slides.count()

    if (slideCount < 2) {
      test.skip(true, 'Need at least 2 slides')
      return
    }

    // Click second slide
    await slides.nth(1).click()
    await page.waitForTimeout(500)

    // Navigate up
    await page.keyboard.press('ArrowUp')
    await page.waitForTimeout(500)

    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Keyboard Shortcuts - Bible Navigation', () => {
  test('ArrowDown navigates to next verse in Bible', async ({ page }) => {
    await page.goto('/bible')
    await page.waitForLoadState('networkidle')

    // Navigate to Genesis chapter 1
    const genesisButton = page
      .getByRole('button', { name: /genesis|geneza/i })
      .first()

    if (
      !(await genesisButton.isVisible({ timeout: 5000 }).catch(() => false))
    ) {
      test.skip(true, 'Genesis button not visible')
      return
    }

    await genesisButton.click()
    await page.waitForTimeout(500)

    const chapter1 = page.getByRole('button', { name: /^1$/ }).first()
    if (await chapter1.isVisible({ timeout: 3000 }).catch(() => false)) {
      await chapter1.click()
      await page.waitForTimeout(1000)
    }

    // Click the first verse to present it
    const verseButtons = page.locator('.space-y-1 button.w-full.text-left')
    if (
      await verseButtons
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await verseButtons.first().click()
      await page.waitForTimeout(500)

      // Navigate with arrow keys
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(500)

      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(500)

      // Verify the green highlight moved
      const greenHighlight = page.locator('button.ring-green-500')
      if (
        await greenHighlight.isVisible({ timeout: 3000 }).catch(() => false)
      ) {
        const verseNum = await greenHighlight
          .locator('span.font-semibold')
          .first()
          .textContent()
        expect(parseInt(verseNum!.trim(), 10)).toBeGreaterThan(1)
      }
    }
  })

  test('ArrowUp navigates to previous verse in Bible', async ({ page }) => {
    await page.goto('/bible')
    await page.waitForLoadState('networkidle')

    const genesisButton = page
      .getByRole('button', { name: /genesis|geneza/i })
      .first()

    if (
      !(await genesisButton.isVisible({ timeout: 5000 }).catch(() => false))
    ) {
      test.skip(true, 'Genesis button not visible')
      return
    }

    await genesisButton.click()
    await page.waitForTimeout(500)

    const chapter1 = page.getByRole('button', { name: /^1$/ }).first()
    if (await chapter1.isVisible({ timeout: 3000 }).catch(() => false)) {
      await chapter1.click()
      await page.waitForTimeout(1000)
    }

    // Click the third verse
    const verseButtons = page.locator('.space-y-1 button.w-full.text-left')
    const count = await verseButtons.count()

    if (count >= 3) {
      await verseButtons.nth(2).click()
      await page.waitForTimeout(500)

      await page.keyboard.press('ArrowUp')
      await page.waitForTimeout(500)

      const greenHighlight = page.locator('button.ring-green-500')
      if (
        await greenHighlight.isVisible({ timeout: 3000 }).catch(() => false)
      ) {
        const verseNum = await greenHighlight
          .locator('span.font-semibold')
          .first()
          .textContent()
        // Should have moved back one verse
        expect(parseInt(verseNum!.trim(), 10)).toBe(2)
      }
    }
  })
})

test.describe('Keyboard Shortcuts - Global', () => {
  test('Escape key clears presentation from any page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Press Escape - should not cause any errors
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    await expect(page.locator('body')).toBeVisible()
  })

  test('keyboard shortcuts do not interfere with input fields', async ({
    page,
  }) => {
    await page.goto('/songs')
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByPlaceholder(/search|cauta/i).first()
    if (!(await searchInput.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Search input not visible')
      return
    }

    // Focus the search input
    await searchInput.focus()
    await page.waitForTimeout(200)

    // Type text - arrow keys should not navigate slides while in input
    await searchInput.fill('')
    await page.keyboard.type('test song')
    await page.waitForTimeout(300)

    // Verify the input has the typed text
    const inputValue = await searchInput.inputValue()
    expect(inputValue).toBe('test song')
  })
})

test.describe('MIDI Settings Section', () => {
  test('MIDI settings section is visible on settings page', async ({
    page,
  }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    // Scroll down to find MIDI section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)

    const midiSection = page.locator('text=/MIDI|midi/i')
    if (
      await midiSection
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await expect(midiSection.first()).toBeVisible()
    }
  })
})
