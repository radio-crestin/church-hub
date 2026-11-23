import type { LookupFunction } from 'node:net'

/**
 * The test server's LAN stand-in (T-193). The server listens on loopback only,
 * so Windows raises no firewall prompt, and requests on its second port
 * (TEST_LAN_PORT) count as coming from a device on the church network: the
 * server judges "local" by the connection, so a Host header alone can't fake
 * it. Devices reach it by a name that, like a LAN address, the app doesn't
 * take for localhost; Chromium (playwright.config.ts) and `lanLookup` resolve
 * it to 127.0.0.1.
 */
export const LAN_HOST = 'church-hub-lan.test'

export function lanAddress(): string {
  return LAN_HOST
}

/** The test server's URL as a LAN device reaches it. */
export function lanBaseUrl(baseURL: string): string {
  const lanPort =
    process.env.TEST_LAN_PORT ?? String(Number(new URL(baseURL).port) + 1)
  return `http://${LAN_HOST}:${lanPort}`
}

/** A `lookup` for Node's http client that resolves LAN_HOST to 127.0.0.1. */
export const lanLookup = ((_hostname, options, callback) => {
  if (typeof options === 'object' && options?.all) {
    callback(null, [{ address: '127.0.0.1', family: 4 }])
  } else {
    callback(null, '127.0.0.1', 4)
  }
}) as LookupFunction
