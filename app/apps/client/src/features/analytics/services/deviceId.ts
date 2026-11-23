const KEY = 'church-hub:analytics-device-id'

/**
 * A random id for this browser or app window, made once and kept in
 * localStorage. It is the PostHog distinct id and the support id the user may
 * send with a feature request. Before it existed PostHog made its own random
 * id; that one is kept so earlier support ids still match.
 */
export function getDeviceId(token: string): string {
  const saved = localStorage.getItem(KEY)
  if (saved) return saved
  const id = previousPostHogId(token) ?? crypto.randomUUID()
  localStorage.setItem(KEY, id)
  return id
}

function previousPostHogId(token: string): string | null {
  const raw = localStorage.getItem(`ph_${token}_posthog`)
  if (!raw) return null
  const id = (JSON.parse(raw) as { distinct_id?: unknown }).distinct_id
  return typeof id === 'string' && id ? id : null
}
