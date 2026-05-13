import { useEffect, useState } from 'react'

import { posthog } from '~/posthog'

const POLL_INTERVAL_MS = 30_000

/**
 * Returns the total number of unread support messages across all of this
 * user's open PostHog conversations tickets. Drives the red dot on the
 * sidebar Feedback button.
 *
 * Polls every 30s — PostHog conversations doesn't expose a push-style
 * subscription. The interval is cheap: getTickets returns a small JSON
 * payload and only fires when conversations is available.
 */
export function useFeedbackUnreadCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let active = true

    const refresh = async () => {
      if (!posthog?.conversations?.isAvailable?.()) {
        if (active) setCount(0)
        return
      }
      try {
        const res = await posthog.conversations.getTickets({ status: 'open' })
        if (!active) return
        const total = (res?.results ?? []).reduce(
          (sum: number, t: { unread_count?: number }) =>
            sum + (t.unread_count ?? 0),
          0,
        )
        setCount(total)
      } catch {
        // Network/transient — keep last known count.
      }
    }

    void refresh()
    const id = window.setInterval(refresh, POLL_INTERVAL_MS)

    // Refresh when the window regains focus so the badge feels live.
    const onFocus = () => {
      void refresh()
    }
    window.addEventListener('focus', onFocus)

    return () => {
      active = false
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return count
}
