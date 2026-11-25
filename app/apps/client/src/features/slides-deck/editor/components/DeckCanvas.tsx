import type { Editor } from '@tiptap/react'
import { useMemo, useRef } from 'react'

import { ElementHitBox } from './ElementHitBox'
import { InlineTextEditor } from './InlineTextEditor'
import { SnapGuides } from './SnapGuides'
import { DeckSlideRenderer } from '../../components/DeckSlideRenderer'
import { DeckSlideStage } from '../../components/DeckSlideStage'
import type { DeckShownSlide, DeckSlide, SlideDeck } from '../../types'
import { useBoxSize } from '../hooks/useBoxSize'
import { useElementGestures } from '../hooks/useElementGestures'
import type { DeckAction } from '../types'

interface DeckCanvasProps {
  deck: SlideDeck
  slide: DeckSlide
  selectedId: string | null
  onSelect: (elementId: string | null) => void
  change: (action: DeckAction, merge?: string) => void
  editingId: string | null
  onEditText: (elementId: string | null) => void
  onTextEditor: (editor: Editor | null) => void
  /** The slide played by Preview, instead of the slide being edited. */
  preview: DeckShownSlide | null
}

/**
 * The slide being edited, as large as fits at the deck's shape: drawn as it
 * is designed, each element grabbed, moved, resized and rotated over it, a
 * text box's text edited in place.
 */
export function DeckCanvas({
  deck,
  slide,
  selectedId,
  onSelect,
  change,
  editingId,
  onEditText,
  onTextEditor,
  preview,
}: DeckCanvasProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const frame = useBoxSize(frameRef)
  const scale =
    Math.min(frame.width / deck.width, frame.height / deck.height) || 0
  const { draft, guides, start } = useElementGestures({
    slide,
    width: deck.width,
    height: deck.height,
    scale,
    canvasRef,
    change,
  })

  // The slide with the dragged element where it is now, and the edited text
  // box left to its editor.
  const shown = useMemo<DeckSlide>(
    () => ({
      ...slide,
      elements: slide.elements.map((e) => {
        if (e.id === editingId) return { ...e, opacity: 0 }
        if (draft?.elementId !== e.id) return e
        return { ...e, ...draft, rotation: draft.rotation || undefined }
      }),
    }),
    [draft, editingId, slide],
  )
  const editing = shown.elements.find(
    (e) => e.id === editingId && (e.type === 'text' || e.type === 'shape'),
  )

  return (
    <div
      ref={frameRef}
      className="relative flex h-full min-h-0 w-full items-center justify-center"
    >
      <div
        ref={canvasRef}
        data-testid="deck-editor-canvas"
        className="relative shadow-lg ring-1 ring-gray-300 dark:ring-gray-700"
        style={{ width: deck.width * scale, height: deck.height * scale }}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget) return
          onEditText(null)
          onSelect(null)
        }}
      >
        {preview ? (
          <DeckSlideRenderer
            shown={preview}
            containerWidth={deck.width * scale}
            containerHeight={deck.height * scale}
            withSound={false}
            isVisible
          />
        ) : (
          <>
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <DeckSlideStage
                slide={shown}
                width={deck.width}
                height={deck.height}
                scale={scale}
                states={null}
                playMedia={false}
                withSound={false}
              />
            </div>
            {shown.elements.map((element) =>
              element.id === editingId ? null : (
                <ElementHitBox
                  key={element.id}
                  element={element}
                  scale={scale}
                  selected={element.id === selectedId}
                  onSelect={() => {
                    if (editingId) onEditText(null)
                    onSelect(element.id)
                  }}
                  onMove={(e) => start(e, element, { kind: 'move' })}
                  onResize={(e, handle) =>
                    start(e, element, { kind: 'resize', handle })
                  }
                  onRotate={(e) => start(e, element, { kind: 'rotate' })}
                  onEditText={() => onEditText(element.id)}
                />
              ),
            )}
            {editing &&
              (editing.type === 'text' || editing.type === 'shape') && (
                <InlineTextEditor
                  key={editing.id}
                  element={editing}
                  scale={scale}
                  onEditor={onTextEditor}
                  onDone={() => onEditText(null)}
                  onChange={(html) =>
                    change(
                      {
                        type: 'element/update',
                        slideId: slide.id,
                        elementId: editing.id,
                        patch: { html },
                      },
                      `text:${editing.id}`,
                    )
                  }
                />
              )}
            <SnapGuides guides={guides} scale={scale} />
          </>
        )}
      </div>
    </div>
  )
}
