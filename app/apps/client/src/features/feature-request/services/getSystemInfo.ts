import { posthog } from '~/posthog'
import { fetcher } from '~/utils/fetcher'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/**
 * Best-effort log upload tied to the user's current PostHog
 * `distinct_id`. The server endpoint `/api/feedback/attach-logs` tails
 * the last 7 days of server + Tauri logs and captures a
 * `$feedback_report` event keyed by the same distinct_id the
 * conversations ticket uses — so when the maintainer opens the ticket
 * in PostHog, the logs are right there under the same person.
 *
 * Fire-and-forget. The user's actual support message
 * (`posthog.conversations.sendMessage`) is independent of this — losing
 * the log upload should never block or surface a failure.
 */
export async function attachFeedbackLogs(): Promise<void> {
  const distinctId = getDistinctId()
  if (!distinctId) return

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

function getDistinctId(): string | null {
  try {
    return posthog?.get_distinct_id?.() ?? null
  } catch {
    return null
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
