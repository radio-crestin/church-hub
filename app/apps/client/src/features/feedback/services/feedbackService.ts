import { posthog } from '~/posthog'
import { fetcher } from '~/utils/fetcher'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/**
 * Opens PostHog's native conversations chat panel and attaches the latest
 * server + Tauri log tails so the maintainer has them ready when the user
 * starts typing.
 *
 * Logs are uploaded under PostHog's current `distinct_id` — the same ID
 * the conversations widget uses for the new ticket. In the dashboard, the
 * support ticket and the `$feedback_report` log event appear under the
 * same person, no manual correlation needed.
 *
 * If conversations is unavailable (project setting off, ad-blocker, etc.)
 * we still upload the logs and return the distinct_id so the caller can
 * surface a graceful fallback message.
 */
export async function openFeedbackChat(): Promise<{
  opened: boolean
  distinctId: string | null
}> {
  // Best-effort log shipment in parallel with opening the chat. The user
  // shouldn't have to wait for it.
  const distinctId = getDistinctId()
  if (distinctId) {
    void attachLogs(distinctId)
  }

  if (!posthog?.conversations?.isAvailable?.()) {
    return { opened: false, distinctId }
  }

  try {
    posthog.conversations.show()
    // Mark messages read when the user opens the chat — the unread badge
    // should clear immediately, not wait for the next poll.
    void posthog.conversations.markAsRead?.()
    return { opened: true, distinctId }
  } catch {
    return { opened: false, distinctId }
  }
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
