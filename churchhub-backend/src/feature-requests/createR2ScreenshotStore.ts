import type { ScreenshotStore } from './screenshotStore'

/** Screenshot store backed by an R2 bucket. */
export function createR2ScreenshotStore(bucket: R2Bucket): ScreenshotStore {
  return {
    async save(image) {
      const id = `${crypto.randomUUID()}.${image.extension}`
      await bucket.put(id, image.bytes, {
        httpMetadata: { contentType: image.contentType },
      })
      return id
    },
    async load(id) {
      const object = await bucket.get(id)
      if (!object) return null
      return {
        body: object.body,
        contentType: object.httpMetadata?.contentType ?? 'image/jpeg',
      }
    },
  }
}
