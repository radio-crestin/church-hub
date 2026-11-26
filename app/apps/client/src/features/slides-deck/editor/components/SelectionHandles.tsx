import type { DeckResizeHandle } from '../utils/resizeBox'

const HANDLES: { handle: DeckResizeHandle; style: React.CSSProperties }[] = [
  { handle: 'nw', style: { left: 0, top: 0, cursor: 'nwse-resize' } },
  { handle: 'n', style: { left: '50%', top: 0, cursor: 'ns-resize' } },
  { handle: 'ne', style: { left: '100%', top: 0, cursor: 'nesw-resize' } },
  { handle: 'e', style: { left: '100%', top: '50%', cursor: 'ew-resize' } },
  { handle: 'se', style: { left: '100%', top: '100%', cursor: 'nwse-resize' } },
  { handle: 's', style: { left: '50%', top: '100%', cursor: 'ns-resize' } },
  { handle: 'sw', style: { left: 0, top: '100%', cursor: 'nesw-resize' } },
  { handle: 'w', style: { left: 0, top: '50%', cursor: 'ew-resize' } },
]

interface SelectionHandlesProps {
  onResize: (event: React.PointerEvent, handle: DeckResizeHandle) => void
  onRotate: (event: React.PointerEvent) => void
}

/** The selected element's 8 resize handles and its rotate handle above it. */
export function SelectionHandles({
  onResize,
  onRotate,
}: SelectionHandlesProps) {
  return (
    <>
      {HANDLES.map(({ handle, style }) => (
        <div
          key={handle}
          data-testid={`deck-editor-handle-${handle}`}
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 touch-none rounded-sm border border-focus bg-panel"
          style={style}
          onPointerDown={(e) => onResize(e, handle)}
        />
      ))}
      <div
        className="absolute left-1/2 h-6 w-px -translate-x-1/2 bg-focus"
        style={{ top: -24 }}
      />
      <div
        data-testid="deck-editor-rotate"
        className="absolute left-1/2 h-3.5 w-3.5 -translate-x-1/2 touch-none cursor-grab rounded-full border border-focus bg-panel"
        style={{ top: -32 }}
        onPointerDown={onRotate}
      />
    </>
  )
}
