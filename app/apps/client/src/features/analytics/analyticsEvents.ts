/**
 * Everything Church Hub sends to PostHog, in one place. The client can only
 * send these events with these properties (`trackEvent` is typed by this
 * list), and Settings > Privacy renders its list from it, so the privacy
 * policy and the code cannot drift apart. Keep docs/privacy-policy.md in step.
 *
 * Each event and property has its explanation in the `privacy` i18n namespace
 * (`events.<name>` and `properties.<name>`).
 */
export const CLIENT_EVENTS = {
  /** A button, link, menu item, tab or switch was pressed. */
  button_pressed: ['element', 'container', 'role', 'icon', 'feature', 'route'],
  /** A keyboard shortcut was pressed (outside text fields). */
  shortcut_used: ['shortcut', 'scope', 'feature', 'route'],
  /** A page was opened. */
  $pageview: ['feature', 'route'],
  /** A page was left (sent by PostHog when the window closes). */
  $pageleave: ['route'],
  /** The app window started. */
  app_started: [],
  /** The app could not reach its server at start. */
  startup_failed: [
    'scope',
    'status',
    'attempts',
    'boot_phase',
    'boot_message',
    'last_error',
    'ever_reachable',
    'total_wait_ms',
    'user_agent',
  ],
  /** An error in the app: its message, type and where in the code. */
  $exception: ['source', 'component'],
  /** A problem that did not stop the app. */
  warning: ['message', 'source', 'component'],
  /** The masked screen recording (session replay). */
  $snapshot: [],
} as const

/** Sent by the server (app/apps/server/src/utils/posthog.ts). */
export const SERVER_EVENTS = {
  app_started: [],
  server_message: ['level', 'message', 'source'],
  $exception: ['source'],
  /** Only when the user sends a feature request: see `feedbackLogs`. */
  $feedback_report: [
    'report_id',
    'os_version',
    'app_version',
    'server_log_tail',
    'tauri_log_tail',
  ],
} as const

/** Sent with every client event (`distinct_id` is the random device id). */
export const COMMON_PROPERTIES = [
  'distinct_id',
  'install_id',
  'component',
  'runtime',
  'release',
  'environment',
] as const

/** What PostHog itself adds to each event: the device and the session. */
export const POSTHOG_PROPERTIES = [
  'token',
  '$device_id',
  '$session_id',
  '$window_id',
  '$lib',
  '$lib_version',
  '$os',
  '$os_version',
  '$browser',
  '$browser_version',
  '$device_type',
  '$screen_height',
  '$screen_width',
  '$viewport_height',
  '$viewport_width',
  '$time',
  '$insert_id',
  '$current_url',
  '$host',
  '$pathname',
  '$process_person_profile',
  '$ip',
  '$geoip_disable',
] as const

/** Property prefixes PostHog needs for errors and the screen recording. */
export const POSTHOG_PROPERTY_PREFIXES = {
  $exception: '$exception_',
  $snapshot: '$snapshot_',
} as const

export type ClientEventName = keyof typeof CLIENT_EVENTS

export type ClientEventProperties<E extends ClientEventName> = Partial<
  Record<
    (typeof CLIENT_EVENTS)[E][number],
    string | number | boolean | null | undefined
  >
>
