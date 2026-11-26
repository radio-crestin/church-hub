import { expect, test } from '@playwright/test'

/**
 * A saved AI key is shown masked and never sent to a new address: choosing
 * another provider clears it, so it is typed again; going back to the saved
 * provider brings the saved key back.
 */
const MASK = '••••••••'

test('changing the AI provider asks for the key again', async ({ page }) => {
  await page.route(
    '**/api/settings/app_settings/songs_ai_search_config',
    (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({
            json: {
              data: {
                id: 1,
                key: 'songs_ai_search_config',
                value: JSON.stringify({
                  enabled: true,
                  provider: 'openai',
                  model: 'gpt-5.2',
                  apiKey: MASK,
                  baseUrl: '',
                }),
                created_at: 0,
                updated_at: 0,
              },
            },
          })
        : route.continue(),
  )
  await page.goto('/settings/songs')
  // The songs AI search key: its field shows "sk-..." when empty.
  const key = page.getByPlaceholder('sk-...')
  await expect(key).toHaveValue(MASK)

  await page.getByRole('button', { name: 'OpenAI', exact: true }).click()
  await page.getByRole('button', { name: 'Anthropic', exact: true }).click()
  await expect(key).toHaveValue('')

  await page.getByRole('button', { name: 'Anthropic', exact: true }).click()
  await page.getByRole('button', { name: 'OpenAI', exact: true }).click()
  await expect(key).toHaveValue(MASK)
})
