import { GripVertical, Music } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  getSongDragState,
  type SongDragState,
  subscribeSongDrag,
} from '../utils/songDragController'

/**
 * The song following the cursor while it is being dragged onto Marcaje or
 * Programe.
 *
 * Mounted once, globally: the drag can start on the song list and end over a
 * panel in a different subtree, so the preview cannot live inside either.
 * Rendered through a portal on `body` so no ancestor's overflow can clip it.
 */
export function SongDragGhost() {
  const [state, setState] = useState<SongDragState>(getSongDragState)

  useEffect(() => subscribeSongDrag(setState), [])

  if (!state.song) return null

  return createPortal(
    <div
      data-testid="song-drag-ghost"
      className="pointer-events-none fixed z-[100] flex max-w-xs items-center gap-2 rounded-[10px] border border-line bg-panel px-3 py-2 text-sm shadow-popover"
      style={{
        // Offset so the card sits under the cursor rather than on top of it.
        left: state.x + 12,
        top: state.y + 12,
        // A hovered zone gets a nod from the ghost too, so the operator knows
        // the release will land before they let go.
        transform: state.activeZoneId ? 'scale(1.03)' : 'scale(1)',
        transition: 'transform 120ms ease-out',
      }}
    >
      <GripVertical size={14} className="shrink-0 text-fg-hint" />
      <Music size={14} className="shrink-0 text-fg-label" />
      <span className="truncate text-sm font-medium text-fg">
        {state.song.title}
      </span>
    </div>,
    document.body,
  )
}
