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
  onEditText,
}: StageCanvasProps) {
  const { t } = useTranslation('songs')

  const { contentType, contentData, contentKey, isVisible } =
    usePresentationContent({ screen, includeNextSlide: false, previewContent })

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
  const handleBlur = useCallback(() => {
    if (clickToEdit) setEditing(false)
  }, [clickToEdit])

  const framed = clickToEdit && editing

  return (
    <div className="w-full">
      {/* Outer frame: reserves the padding + border ring at all times (so
          toggling edit never reflows the slide) and only colours the frame
          while editing, leaving a clear gap around the black canvas. */}
      <div
        ref={stageRef}
        onMouseDown={handleMouseDown}
        onBlur={handleBlur}
        data-editing={framed ? 'true' : 'false'}
        className={`w-full rounded-2xl border-2 p-2 transition-colors ${
          canEdit ? 'cursor-text' : ''
        } ${framed ? 'border-indigo-500 bg-indigo-500/10' : 'border-transparent'}`}
      >
        <div
          className={`relative w-full aspect-video rounded-lg overflow-hidden shadow-lg bg-black ${
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
          />
        </div>
      </div>
      {framed && (
        <p className="mt-2 text-center text-xs text-indigo-500 dark:text-indigo-400">
          {t('stageEditor.editHint')}
        </p>
      )}
    </div>
  )
}
