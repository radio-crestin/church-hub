import { fetcher } from '~/utils/fetcher'
import type { SystemInfo } from './getSystemInfo'

/**
 * Best-effort upload of the server + Tauri log tails to PostHog under the
 * user's support id (`/api/feedback/attach-logs`), so the maintainer can
 * read the logs that go with a request. Fire-and-forget: a failed upload
 * never blocks or fails the request itself.
 */
export async function attachFeedbackLogs(
  supportId: string,
  systemInfo: SystemInfo,
): Promise<void> {
  try {
    await fetcher('/api/feedback/attach-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId: supportId, ...systemInfo }),
    })
  } catch {
    // Best-effort, see above.
  }
}
