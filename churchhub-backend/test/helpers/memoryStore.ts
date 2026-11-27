import type { Bucket } from '../../src/sync/createBucket'
import type { SyncStore } from '../../src/sync/state/ChurchState'

/** A bucket in memory, with S3's conditional writes. */
export function memoryBucket(): Bucket & { keys(): string[] } {
  const objects = new Map<string, { bytes: ArrayBuffer; etag: string }>()
  let version = 0
  return {
    async put(key, body, options) {
      const current = objects.get(key)
      if (options.ifNoneMatch === '*' && current) return null
      if (options.ifMatch !== undefined && current?.etag !== options.ifMatch) {
        return null
      }
      const etag = `"${++version}"`
      objects.set(key, { bytes: body.slice().buffer as ArrayBuffer, etag })
      return etag
    },
    async get(key) {
      return objects.get(key) ?? null
    },
    async etag(key) {
      return objects.get(key)?.etag ?? null
    },
    async list(prefix) {
      return [...objects.keys()].filter((key) => key.startsWith(prefix))
    },
    async delete(key) {
      objects.delete(key)
    },
    publicUrl: (key) => `https://bucket.test/${key}`,
    presignPut: async (key) => `https://bucket.test/${key}?X-Amz-Signature=test`,
    keys: () => [...objects.keys()],
  }
}

/** A sync store whose states share the public bucket, as by default. */
export function memoryStore(): SyncStore & { bucket: ReturnType<typeof memoryBucket> } {
  const bucket = memoryBucket()
  return { bucket, states: bucket, secret: 'test-sync-secret' }
}
