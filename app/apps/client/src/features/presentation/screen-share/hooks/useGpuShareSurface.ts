import { type RefObject, useEffect, useState } from 'react'

import { createLogger } from '~/utils/logger'
import type { VideoElementConfig } from '../../types'
import {
  hideGpuShareSurface,
  showGpuShareSurface,
} from '../service/nativeCapture'

const logger = createLogger('app:screen-share:gpu')

/**
 * In a desktop projector window, asks Rust to draw the share with the GPU
 * over `ref`'s box, following it as it moves or resizes. Returns whether the
 * GPU draws it: false (no GPU, or the capture runs elsewhere) means the page
 * shows the stream itself.
 */
export function useGpuShareSurface(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  objectFit: VideoElementConfig['objectFit'],
): boolean {
  const [gpu, setGpu] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!enabled || !element) return
    let active = true
    let frame = 0

    const place = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const box = element.getBoundingClientRect()
        showGpuShareSurface(
          { x: box.left, y: box.top, width: box.width, height: box.height },
          objectFit,
        )
          .then((drawn) => {
            if (active) setGpu(drawn)
          })
          .catch((error) => {
            logger.warn('GPU surface unavailable, drawing in the page', error)
            if (active) setGpu(false)
          })
      })
    }

    place()
    const observer = new ResizeObserver(place)
    observer.observe(element)
    window.addEventListener('resize', place)
    return () => {
      active = false
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', place)
      setGpu(false)
      hideGpuShareSurface().catch((error) =>
        logger.warn('GPU surface did not close', error),
      )
    }
  }, [ref, enabled, objectFit])

  return gpu
}
