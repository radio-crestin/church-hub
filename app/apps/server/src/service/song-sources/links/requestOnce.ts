import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'

import { isBlockedAddress } from './isBlockedAddress'
import { PRIVATE_ADDRESS_ERROR, vettedLookup } from './vettedLookup'

const TIMEOUT_MS = 60_000
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

  return new Promise((resolve, reject) => {
    const req = client.get(url, { lookup: vettedLookup }, (res) => {
      const chunks: Buffer[] = []
      let size = 0
      res.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_BYTES) {
          req.destroy(new Error('The link is too large to be a song source'))
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
    req.setTimeout(TIMEOUT_MS, () =>
      req.destroy(new Error(`Timed out: ${url}`)),
    )
  })
}
