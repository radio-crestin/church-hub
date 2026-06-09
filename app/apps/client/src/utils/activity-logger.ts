/**
 * Lightweight user-activity logger. Records what the operator does — navigating
 * between pages, logging in/out, switching accounts, clearing logs, and other
 * notable clicks — to the console (debug) AND the on-disk server log (via
 * {@link forwardActivityToServer}) under the `activity` category.
 *
 * This is intentionally distinct from error reporting (error-handler.ts): it's
 * an audit/breadcrumb trail that makes the error logs far easier to interpret
 * ("what was the user doing right before this failed?").
 */
import { forwardActivityToServer } from './forwardActivityToServer'
import { createLogger } from './logger'

const logger = createLogger('app:activity')

interface ActivityContext {
  source?: string
  [key: string]: unknown
}

/**
 * Record a user activity event.
 *
 * @param action  A short, stable action key (e.g. `navigate`, `login`,
 *                `logout`, `account-switch`, `logs.clear`).
 * @param context Optional structured details (path, target user, etc.).
 */
export function captureActivity(
  action: string,
  context?: ActivityContext,
): void {
  const source = context?.source ?? 'app'
  logger.debug(`${action}`, context)
  forwardActivityToServer({
    action,
    message: action,
    source,
    context,
  })
}
