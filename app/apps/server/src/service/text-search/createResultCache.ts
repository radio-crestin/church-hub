export interface ResultCache<Value> {
  get(key: string): Value | undefined
  set(key: string, value: Value): void
  clear(): void
}

/**
 * A small least-recently-used cache of search results: typing back over a
 * query (a backspace, the same search again) answers without a lookup.
 * Entries expire after `ttlMs`.
 */
export function createResultCache<Value>(
  maxSize: number,
  ttlMs: number,
): ResultCache<Value> {
  const entries = new Map<string, { value: Value; storedAt: number }>()
  return {
    get(key) {
      const entry = entries.get(key)
      if (!entry) return undefined
      entries.delete(key)
      if (Date.now() - entry.storedAt > ttlMs) return undefined
      entries.set(key, entry)
      return entry.value
    },
    set(key, value) {
      entries.delete(key)
      if (entries.size >= maxSize) {
        const oldest = entries.keys().next().value
        if (oldest !== undefined) entries.delete(oldest)
      }
      entries.set(key, { value, storedAt: Date.now() })
    },
    clear() {
      entries.clear()
    },
  }
}
