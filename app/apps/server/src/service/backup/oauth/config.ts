import { getServerPort } from '../../../utils/serverPort'

const DRIVE_CALLBACK_PATH = '/api/backup/google/callback'

/** The local origin the worker validates and calls back to. */
export function getLocalOrigin(): string {
  return `http://localhost:${getServerPort()}`
}

/**
 * The local endpoint the worker redirects back to with the tokens once Google
 * authorization completes (mode=redirect). The worker keeps its query and
 * adds the tokens, so the flow's `state` comes back with them.
 */
export function getDriveReturnUrl(state: string): string {
  const url = new URL(DRIVE_CALLBACK_PATH, getLocalOrigin())
  url.searchParams.set('state', state)
  return url.toString()
}
