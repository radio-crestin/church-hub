import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'

import { isBlockedAddress } from './isBlockedAddress'
import { PRIVATE_ADDRESS_ERROR, vettedLookup } from './vettedLookup'

/** No byte for this long: the connection is dead. */
const IDLE_TIMEOUT_MS = 60_000
/**
 * The whole request, however it stalls (DNS, TLS, a body that stopped
 * coming): a check must never hang on one source.
 */
const DEADLINE_MS = 5 * 60_000
/** A song bundle is a few MB; anything far bigger is not one. */
const MAX_BYTES = 200 * 1024 * 1024

export interface LinkResponse {
  status: number
  location: string | null
  body: Uint8Array
}

/**
 * One GET of a link, no redirects followed. The connection goes only to an
 * address vetted by vettedLookup; an IP-literal host (which skips DNS) is
 * checked here.
 */
export function requestOnce(url: URL): Promise<LinkResponse> {
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host) && isBlockedAddress(host)) {
    return Promise.reject(new Error(PRIVATE_ADDRESS_ERROR))
  }
  const client = url.protocol === 'https:' ? https : http

  let deadline: ReturnType<typeof setTimeout> | undefined
  const request = new Promise<LinkResponse>((resolve, reject) => {
    // Bun's req.destroy(error) never emits 'error' while the response has
    // not started, so giving up rejects here, never through the event.
    const fail = (message: string) => {
      req.destroy()
      reject(new Error(message))
    }
    const req = client.get(url, { lookup: vettedLookup }, (res) => {
      const chunks: Buffer[] = []
      let size = 0
      res.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_BYTES) {
          fail('The link is too large to be a song source')
          return
        }
        chunks.push(chunk)
      })
      res.on('end', () =>
        resolve({
          status: res.statusCode ?? 0,
          location: res.headers.location ?? null,
          body: new Uint8Array(Buffer.concat(chunks)),
        }),
      )
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(IDLE_TIMEOUT_MS, () => fail(`Timed out: ${url}`))
    deadline = setTimeout(() => fail(`Took too long: ${url}`), DEADLINE_MS)
  })
  return request.finally(() => clearTimeout(deadline))
}
