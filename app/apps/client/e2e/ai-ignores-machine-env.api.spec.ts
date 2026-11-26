import { expect, test } from '@playwright/test'

import { ExtraServer } from './helpers/extra-server'
import {
  type MockAiProvider,
  startMockAiProvider,
} from './helpers/mock-ai-provider'

/**
 * The AI provider is what the church set in the app, never what the machine's
 * environment says. The AI SDKs fall back to ANTHROPIC_BASE_URL and the like
 * when no base URL is given, so on a machine that sets them for another tool
 * (a local proxy, T-155) the app's AI went there instead.
 */

test.describe.configure({ mode: 'serial', timeout: 300_000 })

let server: ExtraServer
let machineProxy: MockAiProvider

test.beforeAll(async () => {
  machineProxy = await startMockAiProvider('{ "lines": ["from the proxy"] }')
  server = new ExtraServer()
  await server.start({
    ANTHROPIC_BASE_URL: machineProxy.baseUrlFor('anthropic'),
    ANTHROPIC_API_KEY: 'machine-env-key',
  })
})

test.afterAll(async () => {
  await server?.dispose()
  await machineProxy?.close()
})

test('a fresh install has no AI key, whatever the environment holds', async () => {
  const api = await server.adminRequest()
  const response = await api.post('/api/songs/correct-lyrics', {
    data: { text: 'E o noua zi' },
  })
  expect(response.status()).toBe(500)
  expect((await response.json()).error).toContain('AI is not configured')
})

test('a provider set without a base URL does not follow ANTHROPIC_BASE_URL', async () => {
  const api = await server.adminRequest()
  const saved = await api.post('/api/settings/app_settings', {
    data: {
      key: 'songs_ai_search_config',
      value: JSON.stringify({
        enabled: true,
        provider: 'anthropic',
        model: '',
        apiKey: 'church-own-key',
        baseUrl: '',
      }),
    },
  })
  expect(saved.ok()).toBe(true)

  // Goes to Anthropic itself, which refuses the made-up key (or is out of reach).
  const response = await api.post('/api/songs/correct-lyrics', {
    data: { text: 'E o noua zi' },
  })
  expect(response.status()).toBe(500)
  expect(machineProxy.requestPaths).toEqual([])
})
