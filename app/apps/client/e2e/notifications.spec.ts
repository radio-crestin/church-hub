import { expect, type Locator, type Page, test } from '@playwright/test'

/**
 * Every notification shows at the top centre, a little below the edge (and
 * under the phone header), stacked with even gaps, never over the page's own
 * controls. Three refused gallery uploads raise three at once.
 */

const GAP_PX = 12

type Box = { x: number; y: number; width: number; height: number }

function refusedFile(n: number) {
  return {
    name: `e2e-notification-${n}.txt`,
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  }
}

async function raiseThreeNotifications(page: Page) {
  await page.goto('/gallery')
  await expect(page.getByTestId('gallery-page')).toBeVisible({
    timeout: 15000,
  })
  await page
    .getByTestId('gallery-upload-input')
    .setInputFiles([refusedFile(1), refusedFile(2), refusedFile(3)])
  const cards = page.getByTestId('notification')
  await expect(cards).toHaveCount(3)
  // Let the drop-in animation settle before measuring.
  await page.waitForTimeout(400)
  return cards
}

async function boxesOf(cards: Locator): Promise<Box[]> {
  return cards.evaluateAll((elements) =>
    elements.map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect()
      return { x, y, width, height }
    }),
  )
}

function overlaps(a: Box, b: Box) {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  )
}

function expectEvenlyStacked(boxes: Box[], viewportWidth: number) {
  for (const box of boxes) {
    expect(Math.abs(box.x + box.width / 2 - viewportWidth / 2)).toBeLessThan(2)
    expect(box.x).toBeGreaterThanOrEqual(16)
  }
  for (let i = 1; i < boxes.length; i++) {
    const gap = boxes[i].y - (boxes[i - 1].y + boxes[i - 1].height)
    expect(Math.abs(gap - GAP_PX)).toBeLessThan(1)
  }
}

test.describe('Notifications placement', () => {
  test('desktop: top centre, a little lower, evenly stacked', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    const cards = await raiseThreeNotifications(page)
    const boxes = await boxesOf(cards)

    expect(boxes[0].y).toBeGreaterThanOrEqual(48)
    expect(boxes[0].y).toBeLessThanOrEqual(96)
    expectEvenlyStacked(boxes, 1920)

    const uploadButton = await page
      .getByRole('button', { name: /upload|încarcă/i })
      .first()
      .boundingBox()
    expect(uploadButton).not.toBeNull()
    for (const box of boxes) {
      expect(overlaps(box, uploadButton as Box)).toBe(false)
    }

    await expect(cards.first()).toHaveAttribute('data-kind', 'error')
    await expect(cards.first()).toHaveAttribute('role', 'alert')
  })

  test('phone: below the header, inside the screen, evenly stacked', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const cards = await raiseThreeNotifications(page)
    const boxes = await boxesOf(cards)

    const header = await page.locator('header').first().boundingBox()
    expect(header).not.toBeNull()
    const headerBottom = (header as Box).y + (header as Box).height
    expect(boxes[0].y).toBeGreaterThan(headerBottom)
    expectEvenlyStacked(boxes, 390)
    for (const box of boxes) {
      expect(box.x + box.width).toBeLessThanOrEqual(390 - 16)
    }
  })

  test('the close button removes only that notification', async ({ page }) => {
    const cards = await raiseThreeNotifications(page)
    const secondText = await cards.nth(1).innerText()

    await cards.nth(1).getByRole('button').last().click()

    await expect(cards).toHaveCount(2)
    await expect(page.getByText(secondText)).toHaveCount(0)
  })
})
