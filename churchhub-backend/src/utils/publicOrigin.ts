import type { Bindings } from '../types'

/**
 * The origin links handed out by this service start with: PUBLIC_BASE_URL
 * when set (so a forged Host header can't reach a link), else the request's.
 */
export function publicOrigin(
  env: Pick<Bindings, 'PUBLIC_BASE_URL'>,
  requestUrl: string
): string {
  return new URL(env.PUBLIC_BASE_URL || requestUrl).origin
}
