import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * A local stand-in for the Anthropic and Gemini HTTP APIs, so AI search can
 * be tested without a key or network. Point the provider's base URL at
 * `baseUrlFor(provider)`; every request answers with the given text, the way
 * the real API wraps a model reply.
 */
export interface MockAiProvider {
  baseUrlFor: (provider: 'anthropic' | 'gemini') => string
  requestPaths: string[]
  close: () => Promise<void>
}

function anthropicReply(text: string) {
  return {
    id: 'msg_e2e',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-20250514',
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  }
}

function geminiReply(text: string) {
  return {
    candidates: [
      { content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' },
    ],
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 5,
      totalTokenCount: 15,
    },
  }
}

export async function startMockAiProvider(
  replyText: string,
): Promise<MockAiProvider> {
  const requestPaths: string[] = []
  const server: Server = createServer((req, res) => {
    const path = req.url ?? ''
    requestPaths.push(path)
    req.resume()
    req.on('end', () => {
      const body = path.startsWith('/anthropic/')
        ? anthropicReply(replyText)
        : geminiReply(replyText)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  const origin = `http://127.0.0.1:${port}`

  return {
    baseUrlFor: (provider) =>
      provider === 'anthropic'
        ? `${origin}/anthropic/v1`
        : `${origin}/gemini/v1beta`,
    requestPaths,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}
