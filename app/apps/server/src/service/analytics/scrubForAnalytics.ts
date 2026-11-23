import { homedir } from 'node:os'

const ADDRESS = /\b(?:https?|wss?):\/\/[^\s/"'?#]+/g
const IPV4 =
  /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g

/**
 * Removes what could point at a person or a network from a text sent to
 * PostHog: the home folder (it holds the OS user name), web addresses' hosts
 * and IP addresses (LAN addresses included).
 */
export function scrubForAnalytics(text: string): string {
  const home = homedir()
  const withoutHome = home ? text.split(home).join('~') : text
  return withoutHome.replace(ADDRESS, '<address>').replace(IPV4, '<ip>')
}

/** The same scrub over every string in a JSON-like value. */
export function scrubValueForAnalytics<T>(value: T): T {
  if (typeof value === 'string') return scrubForAnalytics(value) as T
  if (Array.isArray(value)) return value.map(scrubValueForAnalytics) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, scrubValueForAnalytics(v)]),
    ) as T
  }
  return value
}
