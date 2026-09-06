import { type DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { GripVertical, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { TemporaryContent } from '~/features/presentation'
import { usePreviewScreen } from '~/features/presentation'
import { useDividerPosition } from '~/hooks/useDividerPosition'
import { ConfirmModal } from '~/ui/modal'
import { isTypingTarget } from '~/utils/isTypingTarget'
import { SlideFilmstrip } from './SlideFilmstrip'
import { StageCanvas } from './StageCanvas'
import { plainTextToSlideHtml } from '../../utils/plainTextToSlideHtml'
import { type LocalSlide } from '../SongSlideList'

/** How many slides after the active one the filmstrip keeps in view. */
const FILMSTRIP_LOOKAHEAD = 2

interface SongStageEditorProps {
  slides: LocalSlide[]
  title: string
  keyLine: string | null
  songId: number | null
  presentedSlideId?: number | null
  /** Bumped by the parent on each navigation (Present/Next/Prev, button or
   * keyboard). The canvas selection reacts to a change in this counter. */
  navSeq?: number
  /** Direction of the last navigation: +1 for Next, -1 for Prev. Used to step
   * the selection when nothing is being projected. */
  navDir?: number
  /** Whether this song is currently live. When true a navigation snaps the
   * selection to the projected slide; when false it steps it by `navDir`. */
  isPresenting?: boolean
  /** When false the canvas is read-only (presentation/navigation mode). */
  editable?: boolean
  /** PowerPoint-style implicit editing: click the stage to edit, and leave edit
   * mode automatically on any slide change. Off = the canvas is always editable
   * (the classic /edit form). */
  clickToEdit?: boolean
  /** Project a slide to the screen by its index, without moving the editor. */
  onProjectSlide?: (index: number) => void
  /** Notifies the parent which slide is currently selected on the canvas, so it
   * can render per-slide UI (e.g. the speaker-notes panel) below the canvas. */
  onActiveSlideChange?: (index: number) => void
  /** Rendered directly under the stage (e.g. presentation nav buttons), hugging
   * its bottom edge. */
  /**
   * Formatting bar for the slide being edited. The canvas shows it only while
   * the in-place editor is mounted.
   */
  canvasToolbar?: React.ReactNode
  canvasFooter?: React.ReactNode
  /** Rendered at the very bottom of the canvas column, below the stage/nav
   * zone (e.g. the speaker-notes panel pinned to the column footer). */
  columnFooter?: React.ReactNode
  /** Fill the parent's height (filmstrip runs to the bottom). Needs a bounded
   * parent — used on the song page, not on the scrolling /edit form. */
  fillHeight?: boolean
  onSlidesChange: (slides: LocalSlide[]) => void
}

function reindex(slides: LocalSlide[]): LocalSlide[] {
  return slides.map((s, idx) => ({ ...s, sortOrder: idx }))
}

/**
 * PowerPoint-style song editor: a filmstrip of slide thumbnails plus a large
 * canvas that renders the current slide exactly as it will be projected and
 * lets the operator edit the lyrics directly on it.
 */
export function SongStageEditor({
  slides,
  title,
  keyLine,
  songId,
  presentedSlideId,
  navSeq = 0,
  navDir = 1,
  isPresenting = false,
  editable = true,
  clickToEdit = false,
  onProjectSlide,
  onActiveSlideChange,
  canvasToolbar,
  canvasFooter,
  columnFooter,
  fillHeight = false,
  onSlidesChange,
}: SongStageEditorProps) {
  const { t } = useTranslation('songs')
  const { screen, isLoading } = usePreviewScreen()

  // Resizable split between the filmstrip (column 1) and the canvas, persisted
  // per device. Only applied on large screens; on mobile the two stack.
  const containerRef = useRef<HTMLDivElement>(null)
  // Scroll viewport of the filmstrip column (column 1). Used to keep the active
  // thumbnail in view as navigation advances through the slides.
  const filmstripScrollRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const [dividerPosition, setDividerPosition] = useDividerPosition(
    'song-stage:filmstrip',
    24,
  )

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => setIsLargeScreen(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current || !containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const next = ((moveEvent.clientX - rect.left) / rect.width) * 100
        setDividerPosition(Math.min(50, Math.max(14, next)))
      }
      const handleMouseUp = () => {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [setDividerPosition],
  )

  // Track the active slide by id so the selection survives reordering/deletion.
  const [activeId, setActiveId] = useState<LocalSlide['id'] | null>(
    slides[0]?.id ?? null,
  )
  const [slideToDelete, setSlideToDelete] = useState<LocalSlide | null>(null)

  // Navigation (Next/Prev/Present, button or keyboard) moves the canvas: the
  // parent bumps `navSeq` and the selection reacts. While presenting we snap to
  // the live projected slide so the stage stays in sync with the output screen;
  // when nothing is live we step the selection by `navDir` so Next/Prev browse
  // the slides on the canvas. We key off `navSeq` (only bumped on navigation),
  // NOT the projected id, so projecting a single slide via the green button
  // still leaves the edited slide untouched.
  const navStateRef = useRef({ slides, presentedSlideId, isPresenting, navDir })
  navStateRef.current = { slides, presentedSlideId, isPresenting, navDir }
  useEffect(() => {
    if (navSeq === 0) return
    const {
      slides: sl,
      presentedSlideId: pid,
      isPresenting: live,
      navDir: dir,
    } = navStateRef.current
    if (live) {
      if (pid != null) setActiveId(pid)
      return
    }
    setActiveId((prev) => {
      const idx = sl.findIndex((s) => s.id === prev)
      const base = idx < 0 ? 0 : idx
      const target = Math.min(Math.max(base + dir, 0), sl.length - 1)
      return sl[target]?.id ?? prev
    })
  }, [navSeq])

  // The canvas always shows the SELECTED slide (the one "you're on"), in both
  // modes — projecting a different slide doesn't move it, and switching to Edit
  // keeps you on this slide. Projection is separate (green button / Present).
  const activeIndex = useMemo(() => {
    const idx = slides.findIndex((s) => s.id === activeId)
    if (idx >= 0) return idx
    return slides.length > 0 ? 0 : -1
  }, [slides, activeId])

  const effectiveIndex = activeIndex < 0 ? 0 : activeIndex
  const effectiveSongId = songId ?? 0

  // Surface the selected slide to the parent (for the notes panel below the
  // canvas), keyed on the effective index so it also fires on first mount.
  useEffect(() => {
    onActiveSlideChange?.(effectiveIndex)
  }, [effectiveIndex, onActiveSlideChange])

  // Keep the active thumbnail in view as navigation advances (e.g. a long song
  // in PowerPoint mode): scroll the filmstrip column only when the active slide
  // or the slides right after it are out of view, never the page. When it does
  // scroll, the active slide goes to the top, so the operator sees what is
  // coming next — a column that only ever showed the active slide at its
  // bottom edge told them nothing about the verse after it.
  useEffect(() => {
    const container = filmstripScrollRef.current
    if (!container || activeIndex < 0) return
    const active = container.querySelector<HTMLElement>(
      `[data-slide-index="${activeIndex}"]`,
    )
    if (!active) return
    const lastAhead = Math.min(
      activeIndex + FILMSTRIP_LOOKAHEAD,
      slides.length - 1,
    )
    const ahead =
      container.querySelector<HTMLElement>(
        `[data-slide-index="${lastAhead}"]`,
      ) ?? active
    const containerRect = container.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()
    const aheadRect = ahead.getBoundingClientRect()
    const margin = 8
    if (
      activeRect.top < containerRect.top + margin ||
      aheadRect.bottom > containerRect.bottom - margin
    ) {
      container.scrollTo({
        top:
          container.scrollTop + (activeRect.top - containerRect.top - margin),
        behavior: 'smooth',
      })
    }
  }, [activeIndex, slides.length])

  // Presenting or navigating hands the keyboard to the active thumbnail.
  // Presenting opens the projection window, which takes the keyboard as it
  // appears; what the control window gets back has to land on something in
  // the page, or the next arrow key goes nowhere until the operator clicks a
  // slide. The thumbnail is a plain button, so the shortcut handlers see its
  // keys like any other.
  //
  // Keyed on the projected slide as well as on navigation: "Present" and the
  // green per-slide button change what is live before the local navigation
  // counter (if any) catches up, and the first projection of a session is
  // exactly when the projection window appears and takes the keyboard.
  // Never taken from a field the operator is typing in.
  useEffect(() => {
    if (navSeq === 0 && presentedSlideId == null) return
    if (isTypingTarget(document.activeElement)) return
    const thumbnail = filmstripScrollRef.current?.querySelector<HTMLElement>(
      `[data-slide-index="${activeIndex}"] [data-testid="stage-thumbnail"]`,
    )
    thumbnail?.focus({ preventScroll: true })
  }, [navSeq, activeIndex, presentedSlideId])

  const previewContent = useMemo<TemporaryContent>(
    () => ({
      type: 'song',
      data: {
        songId: effectiveSongId,
        title,
        keyLine,
        slides: slides.map((s) => ({
          id: typeof s.id === 'number' ? s.id : 0,
          content: s.content,
          chords: s.chords ?? null,
          sortOrder: s.sortOrder,
          styleOverrides: s.styleOverrides ?? null,
        })),
        currentSlideIndex: effectiveIndex,
      },
    }),
    [effectiveSongId, title, keyLine, slides, effectiveIndex],
  )

  // Clicking a slide only selects it (shows it on the canvas) — it never
  // projects. Projection happens via the per-slide green button or Present.
  const handleSelect = useCallback(
    (index: number) => setActiveId(slides[index]?.id ?? null),
    [slides],
  )

  const handleEditText = useCallback(
    (plainText: string) => {
      if (activeIndex < 0) return
      const id = slides[activeIndex].id
      const content = plainTextToSlideHtml(plainText)
      onSlidesChange(slides.map((s) => (s.id === id ? { ...s, content } : s)))
    },
    [activeIndex, slides, onSlidesChange],
  )

  const handleAdd = useCallback(() => {
    const newSlide: LocalSlide = {
      id: `temp-${Date.now()}`,
      content: '',
      sortOrder: slides.length,
    }
    onSlidesChange([...slides, newSlide])
    setActiveId(newSlide.id)
  }, [slides, onSlidesChange])

  const handleClone = useCallback(
    (slide: LocalSlide) => {
      const index = slides.findIndex((s) => s.id === slide.id)
      const clone: LocalSlide = {
        id: `temp-${Date.now()}`,
        content: slide.content,
        chords: slide.chords ? [...slide.chords] : null,
        sortOrder: index + 1,
        label: slide.label,
        styleOverrides: slide.styleOverrides ?? null,
      }
      onSlidesChange(
        reindex([
          ...slides.slice(0, index + 1),
          clone,
          ...slides.slice(index + 1),
        ]),
      )
      setActiveId(clone.id)
    },
    [slides, onSlidesChange],
  )

  const handleDeleteConfirm = useCallback(() => {
    if (!slideToDelete) return
    const index = slides.findIndex((s) => s.id === slideToDelete.id)
    const next = reindex(slides.filter((s) => s.id !== slideToDelete.id))
    onSlidesChange(next)
    // Select a sensible neighbour after deletion.
    const neighbour = next[Math.min(index, next.length - 1)]
    setActiveId(neighbour?.id ?? null)
    setSlideToDelete(null)
  }, [slideToDelete, slides, onSlidesChange])

  const handleReorder = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = slides.findIndex((s) => s.id === active.id)
      const newIndex = slides.findIndex((s) => s.id === over.id)
      onSlidesChange(reindex(arrayMove(slides, oldIndex, newIndex)))
    },
    [slides, onSlidesChange],
  )

  if (isLoading || !screen) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col lg:flex-row gap-3 lg:gap-1 ${
        fillHeight ? 'lg:h-full lg:min-h-0' : ''
      }`}
    >
      {/* Filmstrip (column 1, resizable) */}
      <div
        ref={filmstripScrollRef}
        data-testid="stage-filmstrip-scroll"
        className={`order-2 lg:order-1 lg:overflow-y-auto lg:pr-1 ${
          fillHeight ? 'lg:h-full lg:min-h-0' : 'lg:max-h-[70vh]'
        }`}
        style={isLargeScreen ? { width: `${dividerPosition}%` } : undefined}
      >
        <SlideFilmstrip
          screen={screen}
          songId={effectiveSongId}
          title={title}
          keyLine={keyLine}
          slides={slides}
          activeIndex={activeIndex}
          presentedSlideId={presentedSlideId}
          onSelect={handleSelect}
          onReorder={handleReorder}
          onClone={handleClone}
          onDelete={setSlideToDelete}
          onAdd={handleAdd}
          onProject={onProjectSlide}
        />
      </div>

      {/* Draggable divider */}
      <div
        className={`hidden lg:flex lg:order-2 items-center justify-center w-2 cursor-col-resize hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded transition-colors group shrink-0 ${
          fillHeight ? 'lg:h-full' : ''
        }`}
        onMouseDown={handleDividerMouseDown}
      >
        <GripVertical
          size={16}
          className="text-gray-400 group-hover:text-indigo-500 transition-colors"
        />
      </div>

      {/* Canvas column. In fillHeight mode a size-container "stage zone" fills
          the space above the column footer: the stage fits (letterboxed) and is
          top-aligned with the nav hugging its bottom, so collapsing the notes
          leaves the stage put (it just grows) rather than re-centring. The
          notes panel is pinned to the column footer below the zone. */}
      <div
        className={`order-1 lg:order-3 lg:flex-1 lg:min-w-0 flex flex-col ${
          fillHeight ? 'lg:min-h-0' : ''
        }`}
      >
        {fillHeight ? (
          <div className="flex min-h-0 flex-1 flex-col items-center [container-type:size]">
            <StageCanvas
              screen={screen}
              previewContent={previewContent}
              canEdit={editable && activeIndex >= 0}
              clickToEdit={clickToEdit}
              fitHeight
              editingToolbar={canvasToolbar}
              onEditText={handleEditText}
            />
            {canvasFooter}
          </div>
        ) : (
          <>
            <div className="shrink-0">
              <StageCanvas
                screen={screen}
                previewContent={previewContent}
                canEdit={editable && activeIndex >= 0}
                clickToEdit={clickToEdit}
                editingToolbar={canvasToolbar}
                onEditText={handleEditText}
              />
            </div>
            {canvasFooter}
          </>
        )}
        {columnFooter}
      </div>

      <ConfirmModal
        isOpen={!!slideToDelete}
        onCancel={() => setSlideToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title={t('modal.deleteSlideTitle')}
        message={t('modal.deleteSlideMessage')}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('common:buttons.cancel', 'Cancel')}
        variant="danger"
      />
    </div>
  )
}
