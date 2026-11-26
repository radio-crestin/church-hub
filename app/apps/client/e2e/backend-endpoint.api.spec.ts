import {
  type APIRequestContext,
  type APIResponse,
  expect,
  test,
} from '@playwright/test'

import { ExtraServer } from './helpers/extra-server'
import {
  type RecordingBackend,
  startRecordingBackend,
} from './helpers/recording-backend'
import { SERVER_PORT } from '../playwright.config'

/**
 * One backend for every feature (docs/backend-endpoint.md): a server pointed
 * at a self-hosted backend with CHURCH_HUB_BACKEND_URL sends Google sign-in,
 * cloud sync, the signaling relay, feature requests and listener links
 * there, and nowhere else.
 */

let backend: RecordingBackend
let server: ExtraServer
let api: APIRequestContext

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  test.setTimeout(300_000)
  backend = await startRecordingBackend(SERVER_PORT + 603)
  server = new ExtraServer()
  await server.start({
    CHURCH_HUB_BACKEND_URL: backend.url,
    // No narrower override from the runner's environment.
    CHURCH_HUB_SIGNALING_URL: '',
    CHURCH_HUB_SYNC_URL: '',
  })
  api = await server.adminRequest()
})

test.afterAll(async () => {
  await api?.dispose()
  await server?.dispose()
  await backend?.stop()
})

/** The page a URL opens, without its query. */
const pageOf = (url: string) => {
  const { origin, pathname } = new URL(url)
  return `${origin}${pathname}`
}

const dataOf = async (response: APIResponse) => {
  expect(response.ok(), await response.text()).toBe(true)
  return (await response.json()).data
}

test.describe('The backend set on this machine', () => {
  test('Google sign-in for YouTube, Drive and the cloud owner opens there', async () => {
    const youtube = await dataOf(
      await api.get('/api/livestream/youtube/auth-url?mode=redirect'),
    )
    expect(pageOf(youtube.authUrl)).toBe(`${backend.url}/auth/youtube`)
    const popup = await dataOf(
      await api.get('/api/livestream/youtube/auth-url?mode=postMessage'),
    )
    expect(pageOf(popup.authUrl)).toBe(`${backend.url}/auth/youtube`)

    const drive = await dataOf(await api.get('/api/backup/google/connect'))
    expect(pageOf(drive.authUrl)).toBe(`${backend.url}/auth/drive`)

    const owner = await dataOf(
      await api.post('/api/sync/cloud/owner/sign-in', {
        data: { intent: 'connect' },
      }),
    )
    expect(pageOf(owner.authUrl)).toBe(`${backend.url}/sync/owner/sign-in`)
  })

  test('cloud sync registers the church there', async () => {
    // The stand-in's answer isn't a registration: the church stays off.
    await api.post('/api/sync/cloud', { data: {} })
    expect(backend.requests).toContain('POST /sync/churches')
  })

  test('a feature request is relayed there', async () => {
    const res = await api.post('/api/feature-requests', {
      data: { title: 'A request', description: 'Through the right backend' },
    })
    expect(res.ok()).toBe(true)
    expect(backend.requests).toContain('POST /feature-requests')
  })

  test('remote access opens its room on that relay alone, and its pairing code names it', async () => {
    const settings = await dataOf(
      await api.put('/api/remote-access', { data: { enabled: true } }),
    )
    expect(settings.relay).toBe(backend.url)
    await expect.poll(() => backend.requests).toContain('POST /signal/register')

    await dataOf(
      await api.put('/api/remote-access', { data: { enabled: false } }),
    )
    await expect
      .poll(() => backend.requests)
      .toContain('POST /signal/unregister')
  })

  test('the listener link opens that relay’s listener page', async () => {
    const res = await api.get('/api/live-translation/stream-secret')
    expect(res.ok()).toBe(true)
    const { secret, link } = await res.json()
    expect(link).toBe(`${backend.url}/listen/${secret}`)

    const reset = await api.post('/api/live-translation/stream-secret/reset')
    const renewed = await reset.json()
    expect(renewed.link).toBe(`${backend.url}/listen/${renewed.secret}`)
  })
})

test.describe('A build with no backend set', () => {
  test('keeps the legacy backend every released version uses', async ({
    request,
  }) => {
    const youtube = await dataOf(
      await request.get('/api/livestream/youtube/auth-url?mode=redirect'),
    )
    expect(pageOf(youtube.authUrl)).toBe(
      'https://churchub-backend.radiocrestin.ro/auth/youtube',
    )
  })
})
