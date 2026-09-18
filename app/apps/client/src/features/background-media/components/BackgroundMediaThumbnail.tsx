import type { BackgroundMedia } from '../service'
import { resolveMediaUrl } from '../utils/resolveMediaUrl'

interface BackgroundMediaThumbnailProps {
  media: BackgroundMedia
}

/** A still preview of an uploaded image or video (its first frame). */
export function BackgroundMediaThumbnail({
  media,
}: BackgroundMediaThumbnailProps) {
  const src = resolveMediaUrl(media.url)

  if (media.kind === 'video') {
    return (
      <video
        // A media fragment makes WebKit and Chromium paint the first frame.
        src={`${src}#t=0.1`}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
    )
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      draggable={false}
      className="h-full w-full object-cover"
    />
  )
}
