import { expect, test } from '@playwright/test'

test.use({
  viewport: { width: 1920, height: 1080 },
  video: { mode: 'on', size: { width: 1920, height: 1080 } },
})

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

test('section', async ({ page, request }) => {
  test.setTimeout(180_000)
  const id: number = (await (await request.post('/api/schedules', { data: { title: 'Duminică dimineața' } })).json()).data.id
  for (const text of ['Bun venit!', 'Închideți telefoanele', 'Slujba începe']) {
    await request.post(`/api/schedules/${id}/items`, { data: { slideType: 'announcement', slideContent: `<p>${text}</p>` } })
  }
  try {
    await page.goto(`/schedules/${id}`)
    await expect(page.getByTestId('schedule-run-button')).toBeVisible({ timeout: 60000 })
    await pause(2000)
    await page.getByTestId('schedule-presenter-actions-menu').click()
    await pause(1500)
    await page.getByTestId('schedule-automation-action').click()
    const section = page.getByTestId('schedule-automation-section')
    await expect(section).toBeVisible()
    await pause(2000)
    await section.getByTestId('automation-autoplay').click()
    await pause(800)
    await section.getByTestId('automation-seconds').fill('3')
    await pause(1200)
    await section.getByTestId('automation-loop').click()
    await pause(2000)
    await page.getByTestId('schedule-run-button').click()
    await pause(7500)
    await page.getByTestId('schedule-run-button').click()
    await pause(2000)
  } finally {
    await request.post('/api/schedules/automation/stop')
    await request.post('/api/presentation/clear-temporary')
    await request.delete(`/api/schedules/${id}`)
  }
})

test('list', async ({ page, request }) => {
  test.setTimeout(180_000)
  const id: number = (await (await request.post('/api/schedules', { data: { title: 'Duminică seara' } })).json()).data.id
  try {
    await page.goto('/schedules')
    const card = page.getByRole('button').filter({ hasText: 'Duminică seara' }).first()
    await expect(card).toBeVisible({ timeout: 60000 })
    await pause(2000)
    await page.getByTestId('schedules-actions-menu').click()
    await pause(3000)
    await page.keyboard.press('Escape')
    await pause(1000)
    await card.getByTestId('schedule-card-actions-menu').click()
    await pause(3500)
    await page.keyboard.press('Escape')
    await pause(1000)
  } finally {
    await request.delete(`/api/schedules/${id}`)
  }
})
