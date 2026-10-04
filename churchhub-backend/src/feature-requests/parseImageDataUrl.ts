import { SCREENSHOT_MAX_BYTES } from './constants'
import { FeatureRequestError } from './FeatureRequestError'

const DATA_URL_PATTERN =
  /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/

export interface ParsedImage {
  bytes: Uint8Array
  contentType: string
  extension: string
}

/**
 * Turns a base64 image data URL into bytes. Only JPEG, PNG and WebP are
 * accepted, up to SCREENSHOT_MAX_BYTES (checked before decoding).
 */
export function parseImageDataUrl(dataUrl: string): ParsedImage {
  const match = DATA_URL_PATTERN.exec(dataUrl)
  if (!match) {
    throw new FeatureRequestError(
      'screenshot must be a base64 JPEG, PNG or WebP data URL'
    )
  }
  const [, subtype, base64] = match
  if ((base64.length * 3) / 4 > SCREENSHOT_MAX_BYTES) {
    throw new FeatureRequestError('screenshot is too large', 413)
  }
  const binary = atob(base64)
  return {
    bytes: Uint8Array.from(binary, (char) => char.charCodeAt(0)),
    contentType: `image/${subtype}`,
    extension: subtype === 'jpeg' ? 'jpg' : subtype,
  }
}
