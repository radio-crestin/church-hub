import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { NoteInput } from './NoteInput'
import {
  type NoteSpot,
  useAnnotationCanvas,
} from '../hooks/useAnnotationCanvas'
import type { Annotation, AnnotationTool } from '../types'
import { getToolCursor } from '../utils/getToolCursor'

interface ScreenshotAnnotatorProps {
  screenshot: HTMLCanvasElement
  annotations: Annotation[]
  onAnnotationsChange: (annotations: Annotation[]) => void
  tool: AnnotationTool
  color: string
}

/** The screenshot as a canvas to mark up with the chosen tool and colour. */
export function ScreenshotAnnotator({
  screenshot,
  annotations,
  onAnnotationsChange,
  tool,
  color,
}: ScreenshotAnnotatorProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [noteSpot, setNoteSpot] = useState<NoteSpot | null>(null)
  const canvasHandlers = useAnnotationCanvas(
    canvasRef,
    screenshot,
    annotations,
    onAnnotationsChange,
    tool,
    color,
    (spot) => {
      // A click while a note is open only closes it: its blur saves it.
      if (noteSpot) (document.activeElement as HTMLElement | null)?.blur()
      else setNoteSpot(spot)
    },
  )

  const saveNote = (text: string) => {
    if (noteSpot) {
      onAnnotationsChange([
        ...annotations,
        { kind: 'note', ...noteSpot.canvas, text, color },
      ])
    }
    setNoteSpot(null)
  }

  return (
    <div className="relative w-fit max-w-full mx-auto">
      <canvas
        ref={canvasRef}
        data-testid="feature-request-canvas"
        data-tool={tool}
        aria-label={t('common:featureRequest.canvasLabel')}
        className="block w-auto h-auto max-w-full max-h-[36vh] md:max-h-[44vh] rounded-lg border border-gray-200 dark:border-gray-700 touch-none bg-gray-100 dark:bg-gray-900"
        style={{ cursor: getToolCursor(tool, color) }}
        {...canvasHandlers}
      />
      {noteSpot && (
        <NoteInput
          key={`${noteSpot.canvas.x},${noteSpot.canvas.y}`}
          left={noteSpot.css.x}
          top={noteSpot.css.y}
          boxWidth={canvasRef.current?.clientWidth ?? 0}
          color={color}
          onSave={saveNote}
          onCancel={() => setNoteSpot(null)}
        />
      )}
    </div>
  )
}
