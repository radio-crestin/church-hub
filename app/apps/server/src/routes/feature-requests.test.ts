import { handleFeatureRequestRoutes } from './feature-requests'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { RequestContext } from '../middleware/types'

const USER: RequestContext = { authType: 'user', userId: 1, permissions: [] }
const ROUTE_URL = 'http://localhost:3000/api/feature-requests'

const passThroughCors = (_req: Request, res: Response) => res

let realFetch: typeof fetch
let forwarded: { url: string; body: string }[]

function postRequest(body: string): Request {
  return new Request(ROUTE_URL, { method: 'POST', body })
}

beforeEach(() => {
  forwarded = []
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    forwarded.push({ url: String(input), body: String(init?.body) })
    return Response.json(
      { success: true, issueUrl: 'https://github.com/x/y/issues/7' },
      { status: 200 },
    )
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('POST /api/feature-requests', () => {
  test('relays the body to the worker and returns its response', async () => {
    const body = JSON.stringify({ title: 't', notes: 'n', email: 'a@b.co' })
    const response = await handleFeatureRequestRoutes(
      postRequest(body),
      new URL(ROUTE_URL),
      passThroughCors,
      USER,
    )

    expect(response?.status).toBe(200)
    expect(await response?.json()).toEqual({
      success: true,
      issueUrl: 'https://github.com/x/y/issues/7',
    })
    expect(forwarded).toHaveLength(1)
    expect(forwarded[0].url).toEndWith('/feature-requests')
    expect(forwarded[0].body).toBe(body)
  })

  test('rejects anonymous requests without calling the worker', async () => {
    const response = await handleFeatureRequestRoutes(
      postRequest('{}'),
      new URL(ROUTE_URL),
      passThroughCors,
      null,
    )
    expect(response?.status).toBe(401)
    expect(forwarded).toHaveLength(0)
  })

  test('returns 502 when the worker is unreachable', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    const response = await handleFeatureRequestRoutes(
      postRequest('{}'),
      new URL(ROUTE_URL),
      passThroughCors,
      USER,
    )
    expect(response?.status).toBe(502)
  })

  test('ignores other paths', async () => {
    const otherUrl = 'http://localhost:3000/api/songs'
    const response = await handleFeatureRequestRoutes(
      new Request(otherUrl, { method: 'POST', body: '{}' }),
      new URL(otherUrl),
      passThroughCors,
      USER,
    )
    expect(response).toBeNull()
  })
})
