import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import type {
  ScreenWithConfigs,
  TemporaryContent,
} from '~/features/presentation'
import { ScreenPreview, usePresentationContent } from '~/features/presentation'

interface StageCanvasProps {
  screen: ScreenWithConfigs
  previewContent: TemporaryContent
  /** Plain black instead of the background (the song page's toggle). */
  hideBackground?: boolean
  /** Whether the current slide can be edited (false when there are no slides) */
  canEdit: boolean
  /**
   * Formatting bar for the slide being edited. Rendered above the canvas and
   * only while the in-place editor is actually mounted — the buttons act on the
   * caret or the selection, so they are meaningless without one.
   */
  editingToolbar?: React.ReactNode
  onEditText: (plainText: string) => void
  /**
   * Bumped when the slide's text is rewritten from the formatting bar rather
   * than typed. The in-place editor leaves its own DOM alone while the same
   * slide is open, so this is what tells it to take the new text.
   */
  textVersion?: number
  /** Told when the in-place editor opens and closes. */
  onEditingChange?: (editing: boolean) => void
}

/** Room under the stage for the nav row and the frame's padding and border. */
const FIT_RESERVE_PX = 76

/** Stable identity of the slide currently shown, so we can detect a switch. */
function slideIdentity(content: TemporaryContent): string {
  if (content.type === 'song') {
    return `${content.data.songId}:${content.data.currentSlideIndex}`
  }
  return content.type
}

/**
 * Large WYSIWYG editing canvas. Renders the current slide exactly as it will be
 * projected (via the shared presentation content hook) and makes the lyrics
 * editable in place, PowerPoint-style.
 *
 * Editing is implicit (no mode toggle): clicking the stage mounts the in-place
 * editor and shows a coloured border; changing slide (thumbnail, arrows,
 * Next/Prev) or clicking outside leaves edit mode so the caret never lingers
 * on a slide you didn't open. The canvas fits the height of its size container
 * (letterboxed), so a notes panel below it can grow.
 */
export function StageCanvas({
  screen,
  previewContent,
  hideBackground = false,
  canEdit,
  editingToolbar,
  onEditText,
  textVersion,
  onEditingChange,
}: StageCanvasProps) {
  const { t } = useTranslation('songs')

  const { contentType, contentData, contentKey, isVisible } =
    usePresentationContent({ screen, includeNextSlide: false, previewContent })

  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [editing, setEditing] = useState(false)

  // Leave edit mode the instant the shown slide changes. Runs before paint so
  // the editor for the new slide never flashes a caret. Typing (same slide)
  // doesn't change the identity, so the caret is preserved while editing.
  const slideKey = slideIdentity(previewContent)
  const prevSlideKeyRef = useRef(slideKey)
  useLayoutEffect(() => {
    if (prevSlideKeyRef.current !== slideKey) {
      prevSlideKeyRef.current = slideKey
      setEditing(false)
    }
  }, [slideKey])

  // The in-place editor is only mounted while actually editing — that's what
  // guarantees no stray caret.
  const showEditor = canEdit && editing

  // When entering edit mode, focus the freshly-mounted editor (caret at end).
  useLayoutEffect(() => {
    if (!editing) return
    const el = stageRef.current?.querySelector<HTMLElement>(
      '[data-testid="slide-canvas-editable"]',
    )
    if (!el) return
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [editing])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!canEdit) return
      // Not editing yet → this click starts editing the current slide.
      if (!editing) {
        e.preventDefault()
        setEditing(true)
        return
      }
      // Already editing: clicking the letterboxed background (not the text)
      // still keeps the caret in the editor.
      const el = stageRef.current?.querySelector<HTMLElement>(
        '[data-testid="slide-canvas-editable"]',
      )
      if (el && e.target !== el && !el.contains(e.target as Node)) {
        e.preventDefault()
        el.focus()
      }
    },
    [canEdit, editing],
  )

  // Clicking outside the stage (a button, empty space) blurs the editor and
  // leaves edit mode. Slide-switch is handled separately above.
  //
  // The formatting bar is the exception: its size field has to take focus to be
  // typed in, and leaving edit mode there would unmount the very editor the
  // field is about to restyle. Focus moving anywhere inside this canvas — bar
  // included — keeps editing alive.
  const handleBlur = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget
    if (next instanceof Node && rootRef.current?.contains(next)) return
    setEditing(false)
  }, [])

  const framed = editing
  useEffect(() => {
    onEditingChange?.(framed)
  }, [framed, onEditingChange])

  // Vertical space to reserve inside the stage zone below the black box: the
  // nav row + this frame's padding/border. It is the same whether or not the
  // slide is being edited, so opening the editor never resizes the stage.
  const boxStyle: React.CSSProperties = {
    maxHeight: `calc(100cqh - ${FIT_RESERVE_PX}px)`,
    width: `min(calc(100cqw - 24px), calc((100cqh - ${FIT_RESERVE_PX}px) * 16 / 9))`,
  }

  return (
    <div
      ref={rootRef}
      className="relative flex w-full shrink-0 flex-col items-center"
    >
      {/* The formatting bar floats inside the stage's top edge, PowerPoint-style:
          an overlay, so selecting the slide never moves or resizes the stage or
          anything around it, and it covers none of the page's own buttons. */}
      {showEditor && editingToolbar && (
        <div
          data-testid="slide-style-toolbar-overlay"
          className="absolute left-1/2 top-3 z-30 w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-lg shadow-lg"
        >
          {editingToolbar}
        </div>
      )}
      {/* Outer frame: reserves the padding + border ring at all times (so
          toggling edit never reflows the slide) and only colours the frame
          while editing. It hugs the black box (content width, centred) so the edit border sits uniformly around the canvas,
          and the box sizes to the largest 16:9 that fits within the enclosing
          size container minus the reserved footer space. */}
      <div
        ref={stageRef}
        onMouseDown={handleMouseDown}
        onBlur={handleBlur}
        data-editing={framed ? 'true' : 'false'}
        className={`rounded-2xl border-2 p-2 transition-colors ${
          canEdit ? 'cursor-text' : ''
        } ${framed ? 'border-focus bg-indigo-500/10' : 'border-transparent'} flex w-fit items-center justify-center`}
      >
        <div
          style={boxStyle}
          data-testid="slide-canvas-box"
          className={`relative aspect-video rounded-lg overflow-hidden shadow-lg bg-black ${
            showEditor ? '' : 'select-none'
          }`}
        >
          <ScreenPreview
            screen={screen}
            contentType={contentType}
            contentData={contentData}
            contentKey={contentKey}
            isVisible={isVisible}
            editableMainText={showEditor}
            editPlaceholder={t('stageEditor.emptySlidePlaceholder')}
            onMainTextEdit={onEditText}
            textVersion={textVersion}
            hideBackground={hideBackground}
          />
        </div>
      </div>
    </div>
  )
}
