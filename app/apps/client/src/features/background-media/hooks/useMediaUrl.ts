import { useEffect, useState } from 'react'

import { isTunnelOpen } from '~/features/remote-access/tunnel/tunnelState'
import { resolveMediaUrl } from '../utils/resolveMediaUrl'

/** A stored media file as the page can show it. */
export interface MediaSource {
  /** The URL to load; null while it is fetched, or when unavailable. */
  src: string | null
  /** The server can't give it (a phone away from the church PC). */
  unavailable: boolean
}

const NONE: MediaSource = { src: null, unavailable: false }

/**
 * A stored media URL the page can load (resolveMediaUrl). Over a tunnel
 * the browser can't load the server's address itself: the file comes
 * through it as a blob URL, from the church PC over WebRTC; the server in
 * this browser points it at the church's bucket instead (a redirect, which
 * the page loads and the service worker keeps). A file neither has is
 * `unavailable`.
 */
export function useMediaUrl(url: string | null | undefined): MediaSource {
  const resolved = url ? resolveMediaUrl(url) : null
  const tunneled = !!resolved && isTunnelOpen() && resolved !== url
  const [source, setSource] = useState<MediaSource>(NONE)

  useEffect(() => {
    if (!tunneled || !resolved) return
    setSource(NONE)
    let objectUrl: string | null = null
    let cancelled = false
    const settle = (next: MediaSource) => {
      if (!cancelled) setSource(next)
    }
    window
      .fetch(resolved)
      .then(async (res) => {
        const location = res.headers.get('Location')
        if (res.status === 307 && location) {
          return settle({ src: location, unavailable: false })
        }
        if (!res.ok) return settle({ src: null, unavailable: true })
        const blob = await res.blob()
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        settle({ src: objectUrl, unavailable: false })
      })
      .catch(() => settle({ src: null, unavailable: true }))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [tunneled, resolved])

  if (!resolved) return NONE
  return tunneled ? source : { src: resolved, unavailable: false }
}
