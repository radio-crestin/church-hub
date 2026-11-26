import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { clientIp } from '../src/utils/clientIp'

const app = new Hono().get('/', (c) => c.text(clientIp(c)))

describe('clientIp', () => {
  test('reads CF-Connecting-IP', async () => {
    const response = await app.request('/', { headers: { 'CF-Connecting-IP': '198.51.100.1' } })
    expect(await response.text()).toBe('198.51.100.1')
  })

  test('is unknown without it', async () => {
    expect(await (await app.request('/')).text()).toBe('unknown')
  })
})
