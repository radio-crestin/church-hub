import { Lock } from 'lucide-react'

import { SelectionHandles } from './SelectionHandles'
import type { DeckElement } from '../../types'
import type { DeckResizeHandle } from '../utils/resizeBox'

interface ElementHitBoxProps {
  element: DeckElement
  scale: number
  selected: boolean
  onSelect: () => void
  onMove: (event: React.PointerEvent) => void
  onResize: (event: React.PointerEvent, handle: DeckResizeHandle) => void
  onRotate: (event: React.PointerEvent) => void
  onEditText: () => void
}

/**
 * Where an element is grabbed on the canvas, over the drawn slide: a click
 * selects it, a drag moves it, a double click edits a text box's text. The
 * selected one has its frame and handles; a locked one is selected only.
 */
export function ElementHitBox({
  element,
  scale,
  selected,
  onSelect,
  onMove,
  onResize,
  onRotate,
  onEditText,
}: ElementHitBoxProps) {
  const editable = element.type === 'text' || element.type === 'shape'
  return (
    <div
      data-testid="deck-editor-element"
      data-element-id={element.id}
      data-selected={selected || undefined}
      className={`absolute touch-none ${element.locked ? 'cursor-default' : 'cursor-move'} ${
        selected
          ? element.locked
            ? 'outline-2 outline-dashed outline-focus'
            : 'outline-2 outline-focus'
          : 'hover:outline hover:outline-1 hover:outline-focus/60'
      }`}
      style={{
        left: element.x * scale,
        top: element.y * scale,
        width: element.w * scale,
        height: element.h * scale,
        transform: element.rotation
          ? `rotate(${element.rotation}deg)`
          : undefined,
      }}
      onPointerDown={(e) => {
        onSelect()
        onMove(e)
      }}
      onDoubleClick={editable ? onEditText : undefined}
    >
      {selected && element.locked && (
        <Lock
          size={14}
          strokeWidth={1.75}
          className="absolute -top-5 right-0 text-focus"
        />
      )}
      {selected && !element.locked && (
        <SelectionHandles onResize={onResize} onRotate={onRotate} />
      )}
    </div>
  )
}
