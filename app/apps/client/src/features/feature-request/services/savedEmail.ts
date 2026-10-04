/**
 * The requester's email, remembered on this device after it is first typed
 * so the next request is prefilled. A per-device convenience, so it lives in
 * localStorage (same pattern as `settings.last_section`).
 */
const SAVED_EMAIL_KEY = 'feature_request.email'

export function getSavedEmail(): string {
  try {
    return window.localStorage.getItem(SAVED_EMAIL_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveEmail(email: string): void {
  try {
    window.localStorage.setItem(SAVED_EMAIL_KEY, email.trim())
  } catch {
    // Storage unavailable: the user just types it again next time.
  }
}
