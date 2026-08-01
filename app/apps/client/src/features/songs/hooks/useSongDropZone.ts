import { useCallback, useEffect, useRef, useState } from 'react'

import {
  isSongDrag,
  readSongDragData,
  type SongDragPayload,
} from '../utils/songDragData'

interface SongDropZone {
  /** True while a song is hovering the zone — drives the highlight ring. */
  isOver: boolean
  /**
   * True for a moment right after a drop, so the zone can pulse. Without it a
   * dropped song just appears in the list with no sign it was the drop that
   * put it there.
   */
  justLanded: boolean
  /** Spread onto the element that should accept the drop. */
  dropProps: {
    onDragOver: (event: React.DragEvent) => void
    onDragEnter: (event: React.DragEvent) => void
    onDragLeave: (event: React.DragEvent) => void
    onDrop: (event: React.DragEvent) => void
  }
}

/**
 * Accepts songs dragged out of the song list.
 *
 * Enter/leave are counted rather than toggled: dragging across a child element
 * fires `dragleave` on the parent even though the pointer never left it, which
 * would make the highlight flicker.
 */
export function useSongDropZone(
  onDropSong: ((song: SongDragPayload) => void) | undefined,
): SongDropZone {
  const [isOver, setIsOver] = useState(false)
  const [justLanded, setJustLanded] = useState(false)
  const depth = useRef(0)
  const landedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (landedTimer.current) clearTimeout(landedTimer.current)
    },
    [],
  )

  const reset = useCallback(() => {
    depth.current = 0
    setIsOver(false)
  }, [])

  const onDragEnter = useCallback(
    (event: React.DragEvent) => {
      if (!onDropSong || !isSongDrag(event)) return
      event.preventDefault()
      depth.current += 1
      setIsOver(true)
    },
    [onDropSong],
  )

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      if (!onDropSong || !isSongDrag(event)) return
      // Without preventDefault the browser refuses the drop entirely.
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    },
    [onDropSong],
  )

  const onDragLeave = useCallback(
    (event: React.DragEvent) => {
      if (!onDropSong || !isSongDrag(event)) return
      depth.current -= 1
      if (depth.current <= 0) reset()
    },
    [onDropSong, reset],
  )

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      if (!onDropSong) return
      const song = readSongDragData(event)
      if (!song) return
      event.preventDefault()
      reset()
      onDropSong(song)

      // Matches the .song-drop-land animation duration; re-triggering restarts
      // it cleanly for back-to-back drops.
      setJustLanded(false)
      if (landedTimer.current) clearTimeout(landedTimer.current)
      requestAnimationFrame(() => setJustLanded(true))
      landedTimer.current = setTimeout(() => setJustLanded(false), 600)
    },
    [onDropSong, reset],
  )

  return {
    isOver,
    justLanded,
    dropProps: { onDragOver, onDragEnter, onDragLeave, onDrop },
  }
}
