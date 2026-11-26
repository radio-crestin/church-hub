/**
 * An in-memory stand-in for the SIGNALING_KV namespace: get, put (with
 * `expirationTtl` in seconds) and delete. `entries` exposes what is stored.
 */
export function memoryKv() {
  const entries = new Map<string, { value: string; expiresAt: number }>()
  const live = (key: string) => {
    const entry = entries.get(key)
    if (entry && entry.expiresAt <= Date.now()) entries.delete(key)
    return entries.get(key)
  }
  return {
    entries,
    get: async (key: string) => live(key)?.value ?? null,
    put: async (
      key: string,
      value: string,
      options?: { expirationTtl?: number }
    ) => {
      const ttl = options?.expirationTtl
      entries.set(key, {
        value,
        expiresAt: ttl ? Date.now() + ttl * 1000 : Number.POSITIVE_INFINITY,
      })
    },
    delete: async (key: string) => void entries.delete(key),
  }
}
