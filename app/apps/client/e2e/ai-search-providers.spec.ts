import { type APIRequestContext, expect, test } from '@playwright/test'

import {
  type MockAiProvider,
  startMockAiProvider,
} from './helpers/mock-ai-provider'

/**
 * AI song search must work with Anthropic and Gemini. The provider API is a
 * local mock that answers with the search term "Lauda", which many seeded
 * songs contain. The user query is a nonsense word that matches no song by
 * itself, so a result proves the AI step ran.
 */

const CONFIG_KEY = 'songs_ai_search_config'
const AI_TERMS = '{ "terms": ["Lauda"] }'
const USER_QUERY = 'qqzzxx'
const EXPECTED_SONG = /laud/i

let mockProvider: MockAiProvider
let originalConfig: string | null = null

async function saveAiSearchConfig(
  request: APIRequestContext,
  provider: 'anthropic' | 'gemini',
) {
  const value = JSON.stringify({
    enabled: true,
    provider,
    model: '',
    apiKey: 'e2e-test-key',
    baseUrl: mockProvider.baseUrlFor(provider),
  })
  const response = await request.post('/api/settings/app_settings', {
    data: { key: CONFIG_KEY, value },
  })
  expect(response.status()).toBe(200)
}

test.describe('AI search providers', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ request }) => {
    mockProvider = await startMockAiProvider(AI_TERMS)
    const existing = await request.get(
      `/api/settings/app_settings/${CONFIG_KEY}`,
    )
    if (existing.ok()) originalConfig = (await existing.json()).data?.value
  })

  test.afterAll(async ({ request }) => {
    if (originalConfig) {
      await request.post('/api/settings/app_settings', {
        data: { key: CONFIG_KEY, value: originalConfig },
      })
    } else {
      await request.delete(`/api/settings/app_settings/${CONFIG_KEY}`)
    }
    await mockProvider.close()
  })

  for (const provider of ['anthropic', 'gemini'] as const) {
    test(`${provider}: the API finds songs through the AI terms`, async ({
      request,
    }) => {
      await saveAiSearchConfig(request, provider)
      const callsBefore = mockProvider.requestPaths.length

      const response = await request.post('/api/songs/ai-search', {
        data: { query: USER_QUERY },
      })
      const body = await response.json()

      expect(response.status(), JSON.stringify(body)).toBe(200)
      expect(body.data.termsUsed).toEqual(['Lauda'])
      expect(
        body.data.results.some((song: { title: string }) =>
          EXPECTED_SONG.test(song.title),
        ),
      ).toBe(true)
      expect(mockProvider.requestPaths.length).toBe(callsBefore + 1)
      expect(mockProvider.requestPaths.at(-1)).toContain(`/${provider}/`)
    })
  }

  test('anthropic: the songs page shows the AI results', async ({
    page,
    request,
  }) => {
    await saveAiSearchConfig(request, 'anthropic')
    await page.goto('/songs')

    await page
      .getByPlaceholder(/search|caut/i)
      .first()
      .fill(USER_QUERY)
    const aiButton = page.getByTitle(/AI Search|Căutare AI/)
    const aiResponse = page.waitForResponse((r) =>
      r.url().includes('/api/songs/ai-search'),
    )
    await aiButton.click()

    expect((await aiResponse).status()).toBe(200)
    await expect(page.getByText(EXPECTED_SONG).first()).toBeVisible()
  })
})
