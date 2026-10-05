import { expect, test } from '@playwright/test'

/**
 * The Programs page shows when each program was made (T-101). The API sends
 * Unix seconds; read as milliseconds, every card said "21 Jan 1970".
 */
test('program cards show the real date the program was made', async ({
  page,
  request,
}) => {
  const title = `Dated program ${Date.now()}`
  const res = await request.post('/api/schedules', { data: { title } })
  expect(res.ok()).toBeTruthy()
  const { id } = (await res.json()).data as { id: number }

  try {
    const { data } = await (await request.get(`/api/schedules/${id}`)).json()
    const madeOn = new Date((data.createdAt as number) * 1000)
    expect(madeOn.getFullYear()).toBeGreaterThan(2000)

    await page.goto('/schedules')
    const card = page.getByRole('button').filter({ hasText: title })
    const date = card.getByTestId('schedule-card-date')
    await expect(date).toBeVisible({ timeout: 10000 })

    // The app speaks English or Romanian; the card uses the app's language.
    const formats = ['en', 'ro'].map((language) =>
      madeOn.toLocaleDateString(language, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    )
    expect(formats).toContain(await date.innerText())
    await expect(date).not.toContainText('1970')
  } finally {
    await request.delete(`/api/schedules/${id}`)
  }
})
