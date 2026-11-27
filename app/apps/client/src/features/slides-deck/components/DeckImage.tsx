import { useState } from 'react'

import { MediaUnavailable } from '~/features/background-media/components/MediaUnavailable'
import { useDeckMedia } from '../hooks/useDeckMedia'

interface DeckImageProps {
  mediaId: string
  fit: 'cover' | 'contain' | 'fill'
  /** Fractions cut from each side. */
  crop?: { l: number; t: number; r: number; b: number }
}

/** A picture on a deck slide, cropped like PowerPoint's crop. */
export function DeckImage({ mediaId, fit, crop }: DeckImageProps) {
  const { src, unavailable } = useDeckMedia(mediaId)
  const [failed, setFailed] = useState<string | null>(null)
  if (unavailable || (src && failed === src)) {
    return (
      <div className="relative h-full w-full">
        <MediaUnavailable kind="image" />
      </div>
    )
  }
  if (!src) return null
  if (!crop) {
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        onError={() => setFailed(src)}
        className="block h-full w-full"
        style={{ objectFit: fit }}
      />
    )
  }
  const width = 1 - crop.l - crop.r
  const height = 1 - crop.t - crop.b
  return (
    <div className="relative h-full w-full overflow-hidden">
      <img
        src={src}
        alt=""
        draggable={false}
        onError={() => setFailed(src)}
        className="absolute block max-w-none"
        style={{
          left: `${(-crop.l / width) * 100}%`,
          top: `${(-crop.t / height) * 100}%`,
          width: `${100 / width}%`,
          height: `${100 / height}%`,
          objectFit: 'fill',
        }}
      />
    </div>
  )
}
