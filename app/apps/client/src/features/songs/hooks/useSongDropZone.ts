import { useCallback, useRef, useState } from 'react'

import {
  isSongDrag,
  readSongDragData,
  type SongDragPayload,
} from '../utils/songDragData'

interface SongDropZone {
  /** True while a song is hovering the zone — drives the highlight ring. */
  isOver: boolean
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
  const depth = useRef(0)

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
    },
    [onDropSong, reset],
  )

  return {
    isOver,
    dropProps: { onDragOver, onDragEnter, onDragLeave, onDrop },
  }
}
