import { describe, expect, it } from 'bun:test'
import { isPortFree } from '../isPortFree'

const PORT = 4398

describe('isPortFree', () => {
  it('is true when nothing listens on the port', async () => {
    expect(await isPortFree(PORT)).toBe(true)
  })

  it('is false while a server like ours (all interfaces, reusePort) holds it', async () => {
    const server = Bun.serve({
      port: PORT,
      hostname: '0.0.0.0',
      reusePort: true,
      fetch: () => new Response('held'),
    })
    try {
      expect(await isPortFree(PORT)).toBe(false)
    } finally {
      server.stop(true)
    }
  })

  it('is false while a server holds it on 127.0.0.1 only', async () => {
    const server = Bun.serve({
      port: PORT,
      hostname: '127.0.0.1',
      fetch: () => new Response('held'),
    })
    try {
      expect(await isPortFree(PORT)).toBe(false)
    } finally {
      server.stop(true)
    }
  })
})
