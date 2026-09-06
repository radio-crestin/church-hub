import { expect, test } from '@playwright/test'

/**
 * The reader scrolls through whole chapters, and every chapter carries a label
 * that sticks to the top of the list.
 *
 * The label used to be pinned two pixels above a four-pixel padded edge, so a
 * sliver of the verse scrolling underneath showed above it — a line of text cut
 * in half, right under the panel header. The label now sits flush on the top
 * edge and the chapters sit flush against each other, so whatever the scroll
 * position, the top edge of the list is a chapter label and never a verse.
 */
test.use({ viewport: { width: 1440, height: 900 } })

test.describe('Bible verses list', () => {
  test('no verse ever shows sliced above the chapter label', async ({
    page,
  }) => {
    await page.goto('/bible')
    await page.getByRole('button', { name: 'Ioan', exact: true }).click()
    await page.getByRole('button', { name: '3', exact: true }).click()

    const list = page.getByTestId('bible-verses-scroll')
    await expect(list).toBeVisible({ timeout: 15000 })
    await expect(list.locator('[data-verse]').first()).toBeVisible()

    // Walk the whole loaded chapter (and into its neighbours, which the list
    // loads as it goes) and look at what sits on the list's very top edge.
    const scrollTopsShowingAVerse = await list.evaluate((container) => {
      const element = container as HTMLElement
      const rect = element.getBoundingClientRect()
      const showing: number[] = []

      for (let step = 0; step < 120; step += 1) {
        element.scrollTop = step * 40
        // The first pixels are where the sliver showed: sample the whole strip
        // the sticky label is meant to cover.
        for (const offset of [0.5, 1, 2, 3, 5]) {
          const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + offset,
          )
          if (hit?.closest('[data-verse]')) showing.push(element.scrollTop)
        }
      }

      return showing
    })

    expect(scrollTopsShowingAVerse).toEqual([])
  })
})
