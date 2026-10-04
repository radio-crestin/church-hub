/**
 * AI search must work with every provider the settings offer. The provider's
 * HTTP API is mocked (no key, no network): each test answers the request the
 * way that API does and checks the search terms come back, so a provider
 * package the `ai` SDK rejects (UnsupportedModelVersionError) fails here.
 */

import { generateSearchTerms } from './query-generator'
import type { AISearchConfig } from './types'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'

const TERMS_JSON = '{ "terms": ["har", "iubire"] }'
const MAX_OUTPUT_TOKENS = 600

interface ProviderCase {
  provider: AISearchConfig['provider']
  baseUrl?: string
  expectedUrl: RegExp
  readMaxTokens: (body: Record<string, any>) => unknown
  reply: (text: string) => unknown
}

const CASES: ProviderCase[] = [
  {
    provider: 'anthropic',
    expectedUrl: /api\.anthropic\.com\/v1\/messages$/,
    readMaxTokens: (body) => body.max_tokens,
    reply: (text) => ({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-4-20250514',
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 5 },
    }),
  },
  {
    provider: 'gemini',
    expectedUrl: /generativelanguage\.googleapis\.com\/.*:generateContent$/,
    readMaxTokens: (body) => body.generationConfig?.maxOutputTokens,
    reply: (text) => ({
      candidates: [
        { content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' },
      ],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
        totalTokenCount: 15,
      },
    }),
  },
  ...(['openai', 'custom'] as const).map(
    (provider): ProviderCase => ({
      provider,
      baseUrl: provider === 'custom' ? 'http://localhost:11434/v1' : undefined,
      expectedUrl:
        provider === 'custom'
          ? /localhost:11434\/v1\/chat\/completions$/
          : /api\.openai\.com\/v1\/chat\/completions$/,
      readMaxTokens: (body) => body.max_tokens ?? body.max_completion_tokens,
      reply: (text) => ({
        id: 'chatcmpl-1',
        object: 'chat.completion',
        created: 1_700_000_000,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: text },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    }),
  ),
]

function mockProviderApi(reply: unknown) {
  const requests: { url: string; body: Record<string, any> }[] = []
  spyOn(globalThis, 'fetch').mockImplementation((async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    requests.push({
      url: String(input),
      body: JSON.parse(String(init?.body ?? '{}')),
    })
    return new Response(JSON.stringify(reply), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch)
  return requests
}

describe('AI search providers', () => {
  afterEach(() => {
    ;(
      globalThis.fetch as unknown as { mockRestore?: () => void }
    ).mockRestore?.()
  })

  for (const providerCase of CASES) {
    test(`${providerCase.provider} returns search terms`, async () => {
      const requests = mockProviderApi(providerCase.reply(TERMS_JSON))

      const result = await generateSearchTerms('grace', {
        enabled: true,
        provider: providerCase.provider,
        model: '',
        apiKey: 'test-key',
        baseUrl: providerCase.baseUrl,
      })

      expect(result.terms).toEqual(['har', 'iubire'])
      expect(requests).toHaveLength(1)
      expect(requests[0].url).toMatch(providerCase.expectedUrl)
      expect(providerCase.readMaxTokens(requests[0].body)).toBe(
        MAX_OUTPUT_TOKENS,
      )
    })
  }
})
