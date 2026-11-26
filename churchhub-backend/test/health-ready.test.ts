import { describe, expect, test } from 'bun:test'

import health from '../src/routes/health'
import type { Bindings, SyncReadiness } from '../src/types'

async function ready(readiness?: SyncReadiness) {
  const env = (readiness ? { SYNC_READINESS: readiness } : {}) as Bindings
  const response = await health.request('/health/ready', {}, env)
  return { status: response.status, body: await response.json(), cache: response.headers.get('Cache-Control') }
}

describe('GET /health/ready', () => {
  test('is not ready while the sync probe is pending', async () => {
    expect(await ready('starting')).toEqual({ status: 503, body: { status: 'starting' }, cache: 'no-store' })
  })

  test('is ready once sync is verified', async () => {
    expect((await ready('enabled')).body).toEqual({ status: 'ready', sync: 'enabled' })
  })

  test('stays ready when the probe failed, reporting sync disabled', async () => {
    const result = await ready('disabled')
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ status: 'ready', sync: 'disabled' })
  })

  test('is ready when sync is not configured', async () => {
    expect((await ready('off')).body).toEqual({ status: 'ready', sync: 'off' })
  })

  test('is ready on the Worker, which has no probe', async () => {
    expect(await ready()).toEqual({ status: 200, body: { status: 'ready' }, cache: 'no-store' })
  })
})
