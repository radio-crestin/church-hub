import { fetcher } from '~/utils/fetcher'
import type { FeatureRequestPayload, FeatureRequestResult } from '../types'

// GitHub + WhatsApp round trip through the worker; the screenshot upload
// can take a while on a slow church connection.
const SUBMIT_TIMEOUT_MS = 60_000

/** Sends the request to the local server, which relays it to the backend worker. */
export async function submitFeatureRequest(
  payload: FeatureRequestPayload,
): Promise<FeatureRequestResult> {
  return fetcher<FeatureRequestResult>('/api/feature-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    timeout: SUBMIT_TIMEOUT_MS,
  })
}
