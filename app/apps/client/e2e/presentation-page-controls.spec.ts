import { expect, test } from '@playwright/test'

/**
 * The presentation page (T-182 review): Previous / Next sit above the live
 * preview, the items list's Add button is an icon alone, still named for
 * screen readers and its tooltip, and Run sits just left of Edit as text.
 */

test.use({ viewport: { width: 1440, height: 900 } })

test('Previous / Next sit above the preview; Run, then Edit as text; Add is an icon', async ({
  page,
  request,
}) => {
  const res = await request.post('/api/schedules', {
    data: { title: `E2E Controls ${Date.now()}` },
  })
  expect(res.ok()).toBeTruthy()
  const id: number = (await res.json()).data.id

  try {
    await page.goto(`/schedules/${id}`)
    const next = page.getByTestId('schedule-preview-next')
    const preview = page.getByTestId('live-preview')
    await expect(next).toBeVisible({ timeout: 15_000 })
    await expect(preview).toBeVisible()

    const nextBox = await next.boundingBox()
    const previewBox = await preview.boundingBox()
    expect(nextBox && previewBox).toBeTruthy()
    expect((nextBox?.y ?? 0) + (nextBox?.height ?? 0)).toBeLessThanOrEqual(
      previewBox?.y ?? 0,
    )

    const runBox = await page.getByTestId('schedule-run-button').boundingBox()
    const editBox = await page
      .getByTestId('schedule-edit-as-text')
      .boundingBox()
    expect(runBox && editBox).toBeTruthy()
    // Same row, Run first, right next to it.
    expect(Math.abs((runBox?.y ?? 0) - (editBox?.y ?? 0))).toBeLessThan(8)
    expect((runBox?.x ?? 0) + (runBox?.width ?? 0)).toBeLessThanOrEqual(
      editBox?.x ?? 0,
    )
    expect(
      (editBox?.x ?? 0) - ((runBox?.x ?? 0) + (runBox?.width ?? 0)),
    ).toBeLessThan(16)

    const add = page.getByTestId('schedule-add-item')
    await expect(add).toHaveText('')
    await expect(add).toHaveAccessibleName(/^(Adaugă|Add)$/)
  } finally {
    await request.delete(`/api/schedules/${id}`)
  }
})
