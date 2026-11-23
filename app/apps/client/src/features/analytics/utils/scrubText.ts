const ADDRESS = /\b(?:https?|wss?):\/\/[^\s/"'?#]+/g
const IPV4 =
  /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g

/** Replaces web addresses' hosts and IP addresses (LAN ones too) in a text. */
export function scrubText(text: string): string {
  return text.replace(ADDRESS, '<address>').replace(IPV4, '<ip>')
}

/** The same over every string in a JSON-like value. */
export function scrubValue<T>(value: T): T {
  if (typeof value === 'string') return scrubText(value) as T
  if (Array.isArray(value)) return value.map(scrubValue) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, scrubValue(v)]),
    ) as T
  }
  return value
}
