/**
 * Unified error reporting for the server.
 *
 * Every error worth recording should go to BOTH sinks: the on-disk log (so a
 * user can attach `server-YYYY-MM-DD.log` to a bug report and we can read it
 * offline) AND PostHog (so we hear about field failures without the user having
 * to send anything). Before this helper each call site wired one or the other
 * by hand, so errors regularly landed in only one place. Route them through
 * here instead.
 */
import { logToFile } from './fileLogger'
import { captureException, captureMessage } from './posthog'

/**
 * Report an error to the local log file and PostHog.
 *
 * @param error    The thrown value (Error or anything coercible to one).
 * @param category Short tag used as the log category and PostHog `source`
 *                 (e.g. 'uncaughtException', 'migration', 'fetch-handler').
 * @param context  Extra structured fields attached to both sinks.
 */
export function reportError(
  error: unknown,
  category: string,
  context?: Record<string, unknown>,
): void {
  const err = error instanceof Error ? error : new Error(String(error))

  logToFile(category, 'error', err.message, { stack: err.stack, ...context })
  captureException(err, { source: category, ...context })
}

/**
 * Report a non-fatal but noteworthy condition to the local log file and PostHog.
 */
export function reportWarning(
  message: string,
  category: string,
  context?: Record<string, unknown>,
): void {
  logToFile(category, 'warn', message, context)
  captureMessage(message, 'warning', { source: category, ...context })
}
