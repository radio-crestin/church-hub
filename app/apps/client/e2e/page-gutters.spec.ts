import { expect, test } from '@playwright/test'

/**
 * On a wide screen the panels sit the same distance from the window's bottom
 * edge as from its right edge (DESIGN.md: 16-24px page gutters), so no strip
 * of empty space is left under them.
 */
test.use({ viewport: { width: 1600, height: 900 } })

test('the Bible page leaves the same gutter under its panels as beside them', async ({
  page,
}) => {
  await page.goto('/bible')
  await expect(page.getByTestId('workspace-panel-history')).toBeVisible({
    timeout: 15000,
  })

  const gutters = await page.evaluate(() => {
    const panels = [
      ...document.querySelectorAll('[data-testid^="workspace-panel-"]'),
    ].map((panel) => panel.getBoundingClientRect())
    const right = Math.max(...panels.map((box) => box.right))
    const bottom = Math.max(...panels.map((box) => box.bottom))
    return {
      right: window.innerWidth - right,
      bottom: window.innerHeight - bottom,
    }
  })

  expect(gutters.right).toBeGreaterThan(0)
  expect(Math.abs(gutters.bottom - gutters.right)).toBeLessThanOrEqual(1)
})
