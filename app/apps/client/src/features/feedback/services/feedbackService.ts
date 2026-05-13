import { posthog } from '~/posthog'
import { fetcher } from '~/utils/fetcher'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

interface FeedbackRequest {
  message: string
  osVersion: string
  appVersion: string
  name?: string
  email?: string
}

interface FeedbackResponse {
  success: boolean
  ticketId?: string
  error?: string
}

function generateReportId(): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  return `ch-${uuid.replace(/-/g, '').slice(0, 8)}`
}

/**
 * Submits feedback to PostHog with a deterministic two-track design:
 *
 *   - Preferred: `posthog.conversations.sendMessage()` opens a real
 *     support ticket and returns a `ticket_id`. We use that as the
 *     report ID.
 *
 *   - Fallback: if the conversations feature is unavailable (project
 *     setting off, posthog-js still loading, ad-blocker), we generate
 *     our own report ID and fire a `user_feedback` event under it via
 *     `posthog.capture`. The maintainer queries the ID in PostHog and
 *     sees both the message and the attached logs.
 *
 * Either way we POST `/api/feedback/attach-logs` so the server uploads
 * server + Tauri log tails under the same ID. Feedback NEVER hard-fails
 * just because conversations isn't ready.
 */
export async function submitFeedback(
  data: FeedbackRequest,
): Promise<FeedbackResponse> {
  const messageBody = [
    data.message.trim(),
    '',
    '---',
    `OS: ${data.osVersion}`,
    `App: ${data.appVersion}`,
  ].join('\n')

  let reportId: string | null = null

  // Try PostHog Conversations first.
  if (posthog?.conversations?.isAvailable?.()) {
    try {
      const response = await posthog.conversations.sendMessage(messageBody, {
        name: data.name?.trim() || undefined,
        email: data.email?.trim() || undefined,
      })
      reportId = response?.ticket_id ?? null
    } catch {
      // fall through to the capture fallback
      reportId = null
    }
  }

  // Fallback path — capture as a regular event so triage still works
  // even when the conversations feature is off.
  if (!reportId) {
    reportId = generateReportId()
    try {
      posthog?.capture?.('user_feedback', {
        report_id: reportId,
        message: messageBody,
        os_version: data.osVersion,
        app_version: data.appVersion,
        name: data.name?.trim() || undefined,
        email: data.email?.trim() || undefined,
        $set_once: {
          first_feedback_at: new Date().toISOString(),
        },
      })
    } catch {
      // even capture failed — we still try to attach logs server-side
    }
  }

  // Best-effort log attachment. Doesn't gate success.
  try {
    await fetcher('/api/feedback/attach-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId: reportId,
        osVersion: data.osVersion,
        appVersion: data.appVersion,
      }),
    })
  } catch {
    // ignore — the user's message is already in PostHog
  }

  return { success: true, ticketId: reportId }
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
