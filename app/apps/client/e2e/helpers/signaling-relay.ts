import { startBackendProcess } from './backend-process'
import { SERVER_BASE_URL, SIGNALING_RELAY_URL } from '../../playwright.config'

/**
 * The church's signaling relay: churchhub-backend on its Node entry, rooms
 * in memory (no Redis), where the test server opens its rooms
 * (CHURCH_HUB_SIGNALING_URL) and phones leave their offers. It allows the
 * test server's pages as origins. A spec that needs another relay gives its
 * `url` and the `origin` of the pages that call it. Returns the function that
 * stops it.
 */
export async function startSignalingRelay(
  url = SIGNALING_RELAY_URL,
  origin = SERVER_BASE_URL,
): Promise<() => Promise<void>> {
  const relay = await startBackendProcess(
    'src/node/server.ts',
    {
      NODE_ENV: 'development',
      PORT: new URL(url).port,
      HOST: '127.0.0.1',
      ALLOWED_ORIGINS: origin,
    },
    { ready: [/\[server\] Church Hub backend listening/] },
  )
  return relay.stop
}
