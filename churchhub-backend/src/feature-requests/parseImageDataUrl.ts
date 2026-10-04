import { SCREENSHOT_MAX_BYTES } from './constants'
import { FeatureRequestError } from './FeatureRequestError'

const DATA_URL_PATTERN =
  /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/

export interface ParsedImage {
  base64: string
  extension: string
}

/** Checks a base64 image data URL; rejects other types and oversize images. */
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
  return { base64, extension: subtype === 'jpeg' ? 'jpg' : subtype }
}
