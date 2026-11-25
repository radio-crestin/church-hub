import { createServer, type IncomingMessage } from 'node:http'

import { FAKE_RELAY_URL } from '../../playwright.config'

/**
 * The church's signaling relay (churchhub-backend /signal routes) for the
 * suite: rooms the computer opens, offers phones leave there, answers the
 * computer returns. In memory, and open to any origin like a fetch from the
 * phone app's Tauri HTTP client would be. Returns the function that stops it.
 */
export async function startFakeSignalingRelay(): Promise<() => void> {
  const rooms = new Set<string>()
  const offers = new Map<string, Array<{ sessionId: string; offer: string }>>()
  const answers = new Map<string, string>()
  let nextSession = 0

  const readJson = async (req: IncomingMessage) => {
    let body = ''
    for await (const chunk of req) body += chunk
    return JSON.parse(body || '{}')
  }

  const server = createServer(async (req, res) => {
    const reply = (status: number, data: unknown) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      })
      res.end(JSON.stringify(data))
    }
    if (req.method === 'OPTIONS') return reply(204, {})
    const path = new URL(req.url ?? '/', FAKE_RELAY_URL).pathname
    const [, , secret, action, sessionId] = path.split('/')

    if (req.method === 'POST' && path === '/signal/register') {
      rooms.add((await readJson(req)).secret)
      return reply(200, { success: true })
    }
    if (req.method === 'POST' && path === '/signal/unregister') {
      rooms.delete((await readJson(req)).secret)
      return reply(200, { success: true })
    }
    if (!secret) return reply(404, { error: 'Not found' })
    if (req.method === 'POST' && action === 'offer') {
      if (!rooms.has(secret)) return reply(404, { error: 'Room not found' })
      const id = `session-${++nextSession}`
      const list = offers.get(secret) ?? []
      list.push({ sessionId: id, offer: (await readJson(req)).offer })
      offers.set(secret, list)
      return reply(200, { sessionId: id })
    }
    if (req.method === 'GET' && action === 'offers') {
      const list = offers.get(secret) ?? []
      offers.delete(secret)
      return reply(200, { offers: list })
    }
    if (req.method === 'POST' && action === 'answer') {
      const { sessionId: id, answer } = await readJson(req)
      answers.set(id, answer)
      return reply(200, { success: true })
    }
    if (req.method === 'GET' && action === 'answer' && sessionId) {
      const answer = answers.get(sessionId)
      answers.delete(sessionId)
      return reply(200, answer ? { answer } : { pending: true })
    }
    return reply(404, { error: 'Not found' })
  })

  await new Promise<void>((resolve) =>
    server.listen(Number(new URL(FAKE_RELAY_URL).port), '127.0.0.1', resolve),
  )
  return () => server.close()
}
