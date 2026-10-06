import { expect, test } from '@playwright/test'

import { FakeS3 } from './helpers/fake-s3'

/**
 * A shared song-source link is fetched by this machine, so it must never
 * reach the machine itself or the church's private network: not directly,
 * and not through a redirect. (The suite allows 127.0.0.1 only, for its
 * stand-in S3; every other private range stays refused.)
 */
test.describe('Song source links stay off private networks', () => {
  const s3 = new FakeS3()

  test.beforeAll(async () => {
    await s3.start()
  })
  test.afterAll(async () => {
    await s3.stop()
  })

  const refused = [
    'https://169.254.169.254/latest/meta-data/',
    'https://10.0.0.1/manifest.json',
    'https://172.16.5.4/manifest.json',
    'https://192.168.1.1/manifest.json',
    'https://0.0.0.0/manifest.json',
    'https://[fd00::1]/manifest.json',
    'https://[fe80::1]/manifest.json',
    'https://[::ffff:10.0.0.1]/manifest.json',
  ]
  for (const url of refused) {
    test(`refuses ${url}`, async ({ request }) => {
      const res = await request.post('/api/song-sources', { data: { url } })
      expect(res.status()).toBe(400)
      expect((await res.json()).error).toContain('private network')
    })
  }

  test('refuses a plain-http link to a public host', async ({ request }) => {
    const res = await request.post('/api/song-sources', {
      data: { url: 'http://example.com/manifest.json' },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toContain('https')
  })

  test('refuses a link that redirects into a private network', async ({
    request,
  }) => {
    s3.redirects.set('/church/moved.json', 'https://10.1.2.3/manifest.json')
    const res = await request.post('/api/song-sources', {
      data: { url: `${s3.endpoint}/church/moved.json` },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toContain('private network')
  })
})
