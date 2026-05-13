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

/**
 * Submits feedback through PostHog's conversations/support widget.
 *
 * Flow:
 *   1. `posthog.conversations.sendMessage()` opens a ticket in PostHog,
 *      returns a `ticket_id`.
 *   2. We POST `/api/feedback/attach-logs` with the ticket_id so the
 *      server uploads recent server + Tauri log tails under that ID.
 *   3. The ticket_id is the only reference the user needs — maintainers
 *      look it up in PostHog and see both the user's message and the
 *      logs attached to the same ticket.
 *
 * If `posthog.conversations` isn't initialised yet (network race, feature
 * disabled, ad-blocker), we surface a clear error rather than silently
 * dropping the feedback.
 */
export async function submitFeedback(
  data: FeedbackRequest,
): Promise<FeedbackResponse> {
  if (!posthog.conversations?.isAvailable?.()) {
    return {
      success: false,
      error:
        'Support chat is not available right now. Please check your network connection and try again.',
    }
  }

  // Wrap the user message with system info so the maintainer sees it inline
  // in the ticket, without needing to expand metadata panels.
  const messageBody = [
    data.message.trim(),
    '',
    '---',
    `OS: ${data.osVersion}`,
    `App: ${data.appVersion}`,
  ].join('\n')

  let response: Awaited<
    ReturnType<NonNullable<typeof posthog.conversations>['sendMessage']>
  >
  try {
    response = await posthog.conversations.sendMessage(messageBody, {
      name: data.name?.trim() || undefined,
      email: data.email?.trim() || undefined,
    })
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to open ticket',
    }
  }

  const ticketId = response?.ticket_id
  if (!ticketId) {
    return { success: false, error: 'PostHog did not return a ticket ID' }
  }

  // Best-effort: attach server-side logs to the ticket. A failure here does
  // not invalidate the ticket itself — the user's message is already in
  // PostHog. We swallow the error and still surface the ticket_id.
  try {
    await fetcher('/api/feedback/attach-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId,
        osVersion: data.osVersion,
        appVersion: data.appVersion,
      }),
    })
  } catch {
    // ignore — see comment above
  }

  return { success: true, ticketId }
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
