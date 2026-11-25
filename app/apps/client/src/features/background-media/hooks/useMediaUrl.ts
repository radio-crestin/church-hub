import { useEffect, useState } from 'react'

import { isTunnelOpen } from '~/features/remote-access/tunnel/tunnelState'
import { resolveMediaUrl } from '../utils/resolveMediaUrl'

/**
 * A stored media URL the page can load (resolveMediaUrl). On a phone
 * connected over the WebRTC tunnel, the browser can't load the computer's
 * address itself: the file comes through the tunnel as a blob URL.
 */
export function useMediaUrl(url: string | null | undefined): string | null {
  const resolved = url ? resolveMediaUrl(url) : null
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const tunneled = !!resolved && isTunnelOpen() && resolved !== url

  useEffect(() => {
    if (!tunneled || !resolved) return
    let objectUrl: string | null = null
    let cancelled = false
    window
      .fetch(resolved)
      .then((res) => res.blob())
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)
      })
      .catch(() => setBlobUrl(null))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [tunneled, resolved])

  return tunneled ? blobUrl : resolved
}
