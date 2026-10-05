export const TITLE_MAX_LENGTH = 120
/** Issue title made from the description when the app sends none. */
export const DERIVED_TITLE_MAX_LENGTH = 80
export const NOTES_MAX_LENGTH = 5000
export const SHORT_FIELD_MAX_LENGTH = 500
export const SELECTOR_MAX_LENGTH = 2000
export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024
/** Whole JSON body: a 5 MB screenshot is ~6.7 MB as base64, plus the text. */
export const BODY_MAX_BYTES = 8 * 1024 * 1024
export const GITHUB_REPO = 'radio-crestin/church-hub'
export const GITHUB_ISSUE_LABEL = 'feature-request'
/** Public path of the screenshots the issues embed (served from R2). */
export const SCREENSHOT_ROUTE_PREFIX = '/feature-requests/screenshots'
export const DEFAULT_WAHA_SESSION = 'default'
/** Requests one IP may send in any rolling 24 hours. */
export const DAILY_REQUEST_LIMIT = 50
export const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000
