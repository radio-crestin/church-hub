import { useState } from 'react'

import { MediaUnavailable } from '~/features/background-media/components/MediaUnavailable'
import { useMediaUrl } from '~/features/background-media/hooks/useMediaUrl'
import { useSlideAnimation } from './useSlideAnimation'

interface ScreenImageProps {
  /** The image's stored URL (`/api/media/backgrounds/<id>`); none when no image is shown */
  url: string | undefined
  isVisible: boolean
}

/**
 * A gallery image, full screen over the background, fit inside it on black.
 * It fades in and out like slide text, and one image crossfades into the next.
 */
export function ScreenImage({ url, isVisible }: ScreenImageProps) {
  const { src, unavailable } = useMediaUrl(url)
  const [failed, setFailed] = useState<string | null>(null)
  const layers = useSlideAnimation({
    content: src,
    contentKey: src ?? '',
    isVisible: isVisible && !!src,
  })

  if (isVisible && (unavailable || (src && failed === src))) {
    return <MediaUnavailable kind="image" />
  }
  return layers.map(
    (layer) =>
      layer.content && (
        <img
          key={layer.id}
          data-testid={layer.leaving ? undefined : 'screen-image'}
          src={layer.content}
          alt=""
          draggable={false}
          style={layer.style}
          onError={() => setFailed(layer.content)}
          className="absolute inset-0 h-full w-full bg-black object-contain"
        />
      ),
  )
}
