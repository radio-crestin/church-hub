interface Entry {
  value: string
  expiresAt: number
}

/**
 * The part of a Workers KV namespace the app uses, in this process's memory:
 * values vanish after their `expirationTtl`, and with the process. Safe only
 * with one replica.
 */
export function createMemoryKv(now: () => number = Date.now): KVNamespace {
  const entries = new Map<string, Entry>()

  const read = (key: string): string | null => {
    const entry = entries.get(key)
    if (!entry) return null
    if (entry.expiresAt <= now()) {
      entries.delete(key)
      return null
    }
    return entry.value
  }

  const kv = {
    async get(key: string, type?: 'text' | 'json') {
      const value = read(key)
      if (value === null || type !== 'json') return value
      return JSON.parse(value)
    },
    async put(
      key: string,
      value: string,
      options?: { expirationTtl?: number }
    ) {
      const ttlMs = (options?.expirationTtl ?? Infinity) * 1000
      entries.set(key, { value, expiresAt: now() + ttlMs })
    },
    async delete(key: string) {
      entries.delete(key)
    },
  }
  return kv as unknown as KVNamespace
}
