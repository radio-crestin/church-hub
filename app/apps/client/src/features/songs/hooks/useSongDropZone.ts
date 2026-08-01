import { useCallback, useEffect, useRef, useState } from 'react'

import {
  registerSongDropZone,
  type SongDragPayload,
  subscribeSongDrag,
} from '../utils/songDragController'

interface SongDropZone {
  /** Attach to the element that should accept dropped songs. */
  ref: (node: HTMLElement | null) => void
  /** True while a dragged song is over the zone — drives the highlight ring. */
  isOver: boolean
  /**
   * True for a moment right after a drop, so the zone can pulse. Without it a
   * dropped song just appears in the list with no sign it was the drop that
   * put it there.
   */
  justLanded: boolean
}

/**
 * Accepts songs dragged out of the song list.
 *
 * Registers with `songDragController`, which runs the drag on pointer events —
 * the native HTML5 API was unusable in the desktop webview and collided with
 * the file-import provider. Passing `undefined` leaves the zone unregistered,
 * so a panel that does not accept drops costs nothing.
 */
export function useSongDropZone(
  onDropSong: ((song: SongDragPayload) => void) | undefined,
): SongDropZone {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [isOver, setIsOver] = useState(false)
  const [justLanded, setJustLanded] = useState(false)
  const landedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Kept in a ref so the zone isn't re-registered every render just because
  // the handler's identity changed.
  const handler = useRef(onDropSong)
  handler.current = onDropSong

  const ref = useCallback((next: HTMLElement | null) => setNode(next), [])

  const accepts = !!onDropSong

  useEffect(() => {
    if (!node || !accepts) return

    const { id, unregister } = registerSongDropZone(node, (song) => {
      handler.current?.(song)

      // Matches the .song-drop-land animation; re-triggering restarts it
      // cleanly for back-to-back drops.
      setJustLanded(false)
      if (landedTimer.current) clearTimeout(landedTimer.current)
      requestAnimationFrame(() => setJustLanded(true))
      landedTimer.current = setTimeout(() => setJustLanded(false), 600)
    })

    const unsubscribe = subscribeSongDrag((state) =>
      setIsOver(state.activeZoneId === id),
    )

    return () => {
      unregister()
      unsubscribe()
      setIsOver(false)
    }
  }, [node, accepts])

  useEffect(
    () => () => {
      if (landedTimer.current) clearTimeout(landedTimer.current)
    },
    [],
  )

  return { ref, isOver, justLanded }
}
