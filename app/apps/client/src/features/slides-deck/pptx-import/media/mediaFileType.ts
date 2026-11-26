/** How a media file of the deck is stored, or why it cannot be. */
export type PptxMediaType =
  | { ok: true; kind: 'image' | 'video'; mimeType: string; extension: string }
  | {
      ok: false
      reason: 'unsupportedPicture' | 'convertVideo' | 'unsupportedMedia'
    }

const IMAGES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
}
/** MP4 and its variants (M4V, QuickTime, M4A sound) play as MP4. */
const VIDEOS: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/mp4',
  webm: 'video/webm',
}
const SOUNDS: Record<string, string> = { m4a: 'video/mp4', mp4: 'video/mp4' }

/**
 * What a picture, video or sound of the file is stored as in the gallery,
 * by its extension: pictures a browser draws as they are, MP4/WebM videos
 * and MP4 sound. EMF/WMF/TIFF pictures, other videos (WMV, AVI…: convert
 * them to MP4) and other sounds cannot be shown.
 */
export function mediaFileType(
  path: string,
  use: 'image' | 'video' | 'audio',
): PptxMediaType {
  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  const known = { image: IMAGES, video: VIDEOS, audio: SOUNDS }[use][extension]
  if (!known) {
    return {
      ok: false,
      reason:
        use === 'image'
          ? 'unsupportedPicture'
          : use === 'video'
            ? 'convertVideo'
            : 'unsupportedMedia',
    }
  }
  return {
    ok: true,
    kind: use === 'image' ? 'image' : 'video',
    mimeType: known,
    extension:
      known === 'video/webm' ? 'webm' : use === 'image' ? extension : 'mp4',
  }
}
