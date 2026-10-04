import type { DecodedImage } from './decodeImageDataUrl'

export interface StoredScreenshot {
  body: ReadableStream
  contentType: string
}

/**
 * Where screenshots live so the public GitHub issue can link to them.
 * `getScreenshotStore` picks the implementation; swapping the backing
 * storage (R2, KV, ...) only touches that one file.
 */
export interface ScreenshotStore {
  /** Saves the image and returns its id (a file name like `<uuid>.jpg`). */
  save(image: DecodedImage): Promise<string>
  load(id: string): Promise<StoredScreenshot | null>
}
