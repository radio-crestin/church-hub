import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type {
  ScreenWithConfigs,
  TemporaryContent,
} from '~/features/presentation'
import { ScreenPreview, usePresentationContent } from '~/features/presentation'

interface StageCanvasProps {
  screen: ScreenWithConfigs
  previewContent: TemporaryContent
  /** Whether the current slide can be edited (false when there are no slides) */
  canEdit: boolean
  /**
   * PowerPoint-style implicit editing: editing is OFF until the operator clicks
   * the stage, and turns OFF again the moment the shown slide changes (so the
   * caret never carries over to another slide). When false (e.g. the /edit
   * page) the canvas is simply always editable.
   */
  clickToEdit?: boolean
  /** Fit the canvas within the available height (letterboxed) instead of
   * sizing purely by width — lets the stage shrink so a notes panel below it
   * can grow. */
  fitHeight?: boolean
  /**
   * Formatting bar for the slide being edited. Rendered above the canvas and
   * only while the in-place editor is actually mounted — the buttons act on the
   * caret or the selection, so they are meaningless without one.
   */
  editingToolbar?: React.ReactNode
  onEditText: (plainText: string) => void
}

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
 * With `clickToEdit`, editing is implicit and explicit-state-driven (no mode
 * toggle): clicking the stage mounts the in-place editor and shows a coloured
 * border; changing slide (thumbnail, arrows, Next/Prev) or clicking outside
 * leaves edit mode so the caret never lingers on a slide you didn't open.
 */
export function StageCanvas({
  screen,
  previewContent,
  canEdit,
  clickToEdit = false,
  fitHeight = false,
  editingToolbar,
  onEditText,
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

  // The in-place editor is only mounted while actually editing (clickToEdit) —
  // that's what guarantees no stray caret. Without clickToEdit it's always on.
  const showEditor = clickToEdit ? canEdit && editing : canEdit

  // When entering edit mode, focus the freshly-mounted editor (caret at end).
  useLayoutEffect(() => {
    if (!clickToEdit || !editing) return
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
  }, [clickToEdit, editing])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!canEdit) return
      // Not editing yet → this click starts editing the current slide.
      if (clickToEdit && !editing) {
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
    [canEdit, clickToEdit, editing],
  )

  // Clicking outside the stage (a button, empty space) blurs the editor and
  // leaves edit mode. Slide-switch is handled separately above.
  //
  // The formatting bar is the exception: its size field has to take focus to be
  // typed in, and leaving edit mode there would unmount the very editor the
  // field is about to restyle. Focus moving anywhere inside this canvas — bar
  // included — keeps editing alive.
  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      if (!clickToEdit) return
      const next = event.relatedTarget
      if (next instanceof Node && rootRef.current?.contains(next)) return
      setEditing(false)
    },
    [clickToEdit],
  )

  const framed = clickToEdit && editing

  // Vertical space to reserve inside the stage zone below the black box: the
  // nav row + this frame's padding/border, plus the edit-hint line while
  // editing. Reserving it keeps the nav (and the notes footer below it) from
  // being overlapped — the stage just shrinks a little instead.
  const fitReserve = framed ? 112 : 76
  const boxStyle: React.CSSProperties | undefined = fitHeight
    ? {
        maxHeight: `calc(100cqh - ${fitReserve}px)`,
        width: `min(calc(100cqw - 24px), calc((100cqh - ${fitReserve}px) * 16 / 9))`,
      }
    : undefined

  return (
    <div
      ref={rootRef}
      className={
        fitHeight ? 'flex w-full shrink-0 flex-col items-center' : 'w-full'
      }
    >
      {showEditor && editingToolbar}
      {/* Outer frame: reserves the padding + border ring at all times (so
          toggling edit never reflows the slide) and only colours the frame
          while editing. In fit-height mode it hugs the black box (content
          width, centred) so the edit border sits uniformly around the canvas,
          and the box sizes to the largest 16:9 that fits within the enclosing
          size container minus the reserved footer space. */}
      <div
        ref={stageRef}
        onMouseDown={handleMouseDown}
        onBlur={handleBlur}
        data-editing={framed ? 'true' : 'false'}
        className={`rounded-2xl border-2 p-2 transition-colors ${
          canEdit ? 'cursor-text' : ''
        } ${framed ? 'border-indigo-500 bg-indigo-500/10' : 'border-transparent'} ${
          fitHeight ? 'flex w-fit items-center justify-center' : 'w-full'
        }`}
      >
        <div
          style={boxStyle}
          data-testid="slide-canvas-box"
          className={`relative aspect-video rounded-lg overflow-hidden shadow-lg bg-black ${
            showEditor ? '' : 'select-none'
          } ${fitHeight ? '' : 'w-full'}`}
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
          />
        </div>
      </div>
      {framed && (
        <p className="mt-2 shrink-0 text-center text-xs text-indigo-500 dark:text-indigo-400">
          {t('stageEditor.editHint')}
        </p>
      )}
    </div>
  )
}
