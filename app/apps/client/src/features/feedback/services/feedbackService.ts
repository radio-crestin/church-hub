import { posthog } from '~/posthog'
import { fetcher } from '~/utils/fetcher'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export type OpenFeedbackChatResult = {
  method: 'posthog' | 'fallback'
  distinctId: string | null
}

/**
 * Opens PostHog's native conversations chat panel and attaches the latest
 * server + Tauri log tails so the maintainer has them ready when the user
 * starts typing.
 *
 * Synchronous on purpose: the caller (sidebar Feedback button) needs to
 * decide on the same tick whether to render the fallback ContactModal —
 * any async hop means the user clicks and sees nothing for a frame, which
 * is the exact "click then wait for posthog" experience we're killing.
 *
 * Logs are uploaded under PostHog's current `distinct_id` in the
 * background. The support ticket and the `$feedback_report` log event end
 * up under the same person in the dashboard, no manual correlation.
 *
 * Returns `method: 'fallback'` when conversations isn't loaded (project
 * setting off, ad-blocker, slow first paint) so the sidebar can open the
 * ContactModal immediately instead of swallowing the click.
 */
export function openFeedbackChat(): OpenFeedbackChatResult {
  // Best-effort log shipment in parallel with opening the chat. The user
  // shouldn't have to wait for it.
  const distinctId = getDistinctId()
  if (distinctId) {
    void attachLogs(distinctId)
  }

  if (posthog?.conversations?.isAvailable?.()) {
    try {
      posthog.conversations.show()
      // Mark messages read only when there's an active ticket — calling
      // markAsRead() with no current conversation throws
      // "No ticket ID provided and no active conversation" and bubbles
      // up as an unhandledrejection.
      if (posthog.conversations.getCurrentTicketId?.()) {
        void posthog.conversations.markAsRead?.()
      }
      return { method: 'posthog', distinctId }
    } catch {
      // fall through to fallback
    }
  }

  return { method: 'fallback', distinctId }
}

function getDistinctId(): string | null {
  try {
    return posthog?.get_distinct_id?.() ?? null
  } catch {
    return null
  }
}

async function attachLogs(distinctId: string): Promise<void> {
  let osVersion = 'Unknown'
  let appVersion = 'Unknown'
  try {
    const sys = await getSystemInfo()
    osVersion = sys.osVersion
    appVersion = sys.appVersion
  } catch {
    // ignore
  }
  try {
    await fetcher('/api/feedback/attach-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId: distinctId, osVersion, appVersion }),
    })
  } catch {
    // Best-effort — the user's message is already in PostHog under the
    // same distinct_id, so the maintainer can still triage.
  }
}

export async function getSystemInfo(): Promise<{
  osVersion: string
  appVersion: string
}> {
  let osVersion = 'Unknown'
  let appVersion = 'Unknown'

  if (isTauri) {
    try {
      const { getVersion } = await import('@tauri-apps/api/app')
      appVersion = await getVersion()
    } catch {
      appVersion = 'Unknown'
    }

    try {
      const { type, version, arch } = await import('@tauri-apps/plugin-os')
      const osType = type()
      const osVer = version()
      const osArch = arch()
      osVersion = `${osType} ${osVer} (${osArch})`
    } catch {
      osVersion = navigator.userAgent
    }
  } else {
    osVersion = navigator.userAgent
    appVersion = 'Web'
  }

  return { osVersion, appVersion }
}
