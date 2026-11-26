import { request as httpRequest } from 'node:http'

import { lanLookup } from './lan-address'

/**
 * A request with full control of its headers (Host, Origin, Sec-Fetch-*),
 * which browser-style clients refuse to set. Reaches the LAN stand-in's name
 * too (lanLookup).
 */

export interface RawResponse {
  status: number
  headers: Record<string, string | string[] | undefined>
  body: string
}

export function rawRequest(
  baseURL: string,
  path: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: string | Buffer
  } = {},
): Promise<RawResponse> {
  const url = new URL(path, baseURL)
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: url.hostname,
        port: url.port,
        lookup: lanLookup,
        path: url.pathname + url.search,
        method: options.method ?? 'GET',
        headers: options.headers,
      },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          body += chunk
        })
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body }),
        )
      },
    )
    req.on('error', reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}
