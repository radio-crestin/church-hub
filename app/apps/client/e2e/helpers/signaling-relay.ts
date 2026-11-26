import { startBackendProcess } from './backend-process'
import { SERVER_BASE_URL, SIGNALING_RELAY_URL } from '../../playwright.config'

/**
 * The church's signaling relay: churchhub-backend's real app on an in-memory
 * KV, where the test server opens its rooms (CHURCH_HUB_SIGNALING_URL) and
 * phones leave their offers. It allows the test server's pages as origins.
 * Returns the function that stops it.
 */
export async function startSignalingRelay(): Promise<() => Promise<void>> {
  const relay = await startBackendProcess(
    'test/support/serveSignalingRelay.ts',
    {
      PORT: new URL(SIGNALING_RELAY_URL).port,
      ALLOWED_ORIGINS: SERVER_BASE_URL,
    },
    /\[signal\] relay listening/,
  )
  return relay.stop
}
