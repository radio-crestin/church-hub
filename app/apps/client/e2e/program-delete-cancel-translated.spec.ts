import { expect, test } from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'

/**
 * T-165: the delete-program dialog's Cancel read "actions.cancel": it asked
 * the common namespace for a key that lives under `buttons`.
 */
for (const [lang, cancel, del] of [
  ['ro', 'Anulează', 'Șterge'],
  ['en', 'Cancel', 'Delete'],
] as const) {
  test(`delete-program dialog shows a translated Cancel (${lang})`, async ({
    page,
    request,
  }) => {
    const created = await request.post('/api/schedules', {
      data: { title: `E2E Cancel ${lang} ${Date.now()}` },
    })
    expect(created.ok()).toBeTruthy()
    const schedule = (await created.json()).data as { id: number }

    try {
      await setAppLanguage(page, lang)
      await page.goto(`/schedules/${schedule.id}`)
      await page.getByTitle(del, { exact: true }).click()
      const dialog = page.locator('dialog[open]')
      await expect(
        dialog.getByRole('button', { name: cancel, exact: true }),
      ).toBeVisible()
      await expect(dialog).not.toContainText('actions.cancel')
    } finally {
      await request.delete(`/api/schedules/${schedule.id}`)
    }
  })
}
