import {
  Check,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Loader2,
  Play,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePageShortcutEvent } from '~/features/keyboard-shortcuts/utils'
import {
  useClearTemporaryContent,
  useNavigateTemporary,
  usePresentationState,
  usePreviewScreen,
} from '~/features/presentation'
import type { ScheduleFlatNavigation } from '~/features/schedules'
import { SlideNotesPanel } from './SlideNotesPanel'
import { SlideStyleToolbar } from './SlideStyleToolbar'
import { SongStageEditor } from './SongStageEditor'
import { StageTimer } from './StageTimer'
import { useSongKeyboardShortcuts, useUpsertSong } from '../../hooks'
import type { SlideStyleOverride, SongSlide, SongWithSlides } from '../../types'
import { adoptSavedSlideIds } from '../../utils/adoptSavedSlideIds'
import { expandSongSlidesWithChoruses } from '../../utils/expandSongSlides'
import { plainTextToSlideHtml } from '../../utils/plainTextToSlideHtml'
import { SlideCounter } from '../SlideCounter'
import { type LocalSlide } from '../SongSlideList'

interface SongStageBoardProps {
  song: SongWithSlides
  /**
   * The program selected in the Programe panel. While one of its steps is on
   * the projector, Next/Prev walk the program rather than just this song.
   */
  scheduleNav: ScheduleFlatNavigation
  /**
   * Projects a slide of this song by its (chorus-expanded) index — as a step of
   * the selected program while that program is on the projector and holds the
   * song, so it keeps its place; on its own otherwise. Same rule as the classic
   * page.
   */
  onPresentSlide: (slideIndex: number) => Promise<void>
}

const AUTOSAVE_DELAY_MS = 1000
/**
 * While the song is live, edits have to reach the projector, and that only
 * happens once they are saved — so the wait drops to something the operator
 * reads as immediate.
 */
const LIVE_AUTOSAVE_DELAY_MS = 200

function mapSlides(song: SongWithSlides): LocalSlide[] {
  return song.slides.map((s) => ({
    id: s.id,
    content: s.content,
    chords: s.chords,
    sortOrder: s.sortOrder,
    label: s.label,
    notes: s.notes,
    styleOverrides: s.styleOverrides,
  }))
}

/** Stable signature of the editable parts of the slides, for dirty detection. */
function serialize(slides: LocalSlide[]): string {
  return JSON.stringify(
    slides.map((s) => ({
      content: s.content,
      label: s.label ?? null,
      chords: s.chords ?? null,
      notes: s.notes ?? null,
      styleOverrides: s.styleOverrides ?? null,
    })),
  )
}

/** `serialize` plus the slide ids: tells one stored version of the song from another. */
function signature(slides: LocalSlide[]): string {
  return `${JSON.stringify(slides.map((s) => s.id))}${serialize(slides)}`
}

/**
 * PowerPoint-layout editing surface shown directly on the song page. Owns the
 * editable slide draft, autosaves changes (slides-only — the server preserves
 * the rest of the song's metadata), and lets the operator present from the start.
 */
export function SongStageBoard({
  song,
  scheduleNav,
  onPresentSlide,
}: SongStageBoardProps) {
  const { t } = useTranslation(['songs', 'bible'])
  const upsert = useUpsertSong()
  const navigateTemporary = useNavigateTemporary()
  const clearTemporary = useClearTemporaryContent()
  const { data: presentationState } = usePresentationState()
  // The screen the stage previews. Its width is what turns the size rendered on
  // the (scaled-down) canvas into the screen's own units for the toolbar.
  const { screen } = usePreviewScreen()
  const canvasWidth = screen?.width ?? 1920

  const [slides, setSlides] = useState<LocalSlide[]>(() => mapSlides(song))
  const [savedSerialized, setSavedSerialized] = useState(() =>
    serialize(mapSlides(song)),
  )
  // Bumped when the draft's text is rewritten from outside the in-place editor
  // (the formatting bar, a save made elsewhere). The editor leaves its own DOM
  // alone while the same slide is open, so it has to be told.
  const [textVersion, setTextVersion] = useState(0)
  // Which slide the canvas is on — drives the speaker-notes panel below it.
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)

  // The song the draft belongs to, and the signature of the slides the server
  // was last known to hold for it: what the draft was seeded from, or what the
  // board's own latest save stored.
  const loadedSongIdRef = useRef(song.id)
  const serverSignatureRef = useRef<string | null>(null)

  const currentSerialized = serialize(slides)
  const isDirty = currentSerialized !== savedSerialized

  // Saves run one after another, each sending the draft as it stands when its
  // turn comes. Two overlapping saves would both send a new slide without an
  // id, and the second would replace the row the first had just created.
  const slidesRef = useRef(slides)
  slidesRef.current = slides
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve())
  // Saves running or waiting their turn.
  const pendingSavesRef = useRef(0)
  const save = useCallback(() => {
    const songId = song.id
    const run = async () => {
      const sent = slidesRef.current
      const result = await upsert.mutateAsync({
        id: songId,
        title: song.title,
        slides: sent.map((s, idx) => ({
          id: typeof s.id === 'number' ? s.id : undefined,
          content: s.content,
          chords: s.chords,
          sortOrder: idx,
          label: s.label,
          notes: s.notes,
          styleOverrides: s.styleOverrides ?? null,
        })),
      })
      // The operator moved to another song while this one was saving; the
      // draft now belongs to that song.
      if (loadedSongIdRef.current !== songId) return
      if (result.success && result.data) {
        const savedSlides = result.data.slides
        serverSignatureRef.current = signature(mapSlides(result.data))
        // The ref is what the next queued save reads, and it may run before
        // this state update has rendered.
        slidesRef.current = adoptSavedSlideIds(
          slidesRef.current,
          sent,
          savedSlides,
        )
        setSlides((prev) => adoptSavedSlideIds(prev, sent, savedSlides))
      }
      setSavedSerialized(serialize(sent))
    }
    pendingSavesRef.current += 1
    const queued = saveQueueRef.current.then(run).finally(() => {
      pendingSavesRef.current -= 1
    })
    // A failed save still reaches its caller; the queue itself moves on.
    saveQueueRef.current = queued.catch(() => undefined)
    return queued
  }, [upsert, song.id, song.title])

  /**
   * Persists pending edits right now instead of waiting out the autosave.
   *
   * What is projected comes from a snapshot the server takes when the song is
   * presented and refreshes when it is saved, so navigating with an unsaved
   * edit showed the slide as it was before the edit and only corrected itself
   * once the autosave landed a second later.
   */
  const saveRef = useRef(save)
  saveRef.current = save
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty
  const flushSave = useCallback(async () => {
    if (!isDirtyRef.current) return
    await saveRef.current()
  }, [])

  // Takes in what the server now holds for the song: a different song opened
  // on the page, or a save of this one made elsewhere — the Edit page, the
  // editor modal behind the Marcaje/Programe pencils, another device. Seeding
  // the draft only once left the stage on the old lyrics, and its next
  // autosave wrote them back over that save. The board's own saves come back
  // matching `serverSignatureRef` and change nothing. While a save is running
  // or waiting, or the operator has edits not saved yet, the draft stays: it is
  // what gets written next.
  useEffect(() => {
    const fresh = mapSlides(song)
    const freshSignature = signature(fresh)
    if (loadedSongIdRef.current === song.id) {
      // First run: the draft was seeded from exactly this data.
      if (serverSignatureRef.current === null) {
        serverSignatureRef.current = freshSignature
        return
      }
      if (freshSignature === serverSignatureRef.current) return
      if (pendingSavesRef.current > 0 || isDirtyRef.current) return
    }
    loadedSongIdRef.current = song.id
    serverSignatureRef.current = freshSignature
    setSlides(fresh)
    setSavedSerialized(serialize(fresh))
    setTextVersion((version) => version + 1)
  }, [song])

  // Debounced autosave: persist slides shortly after the last edit. Also keyed
  // on what was last saved: text typed while a save was running leaves the
  // draft dirty throughout, and would otherwise wait for the next navigation —
  // blocking saves made elsewhere from reaching the stage until then.
  useEffect(() => {
    if (!isDirty) return
    const timer = setTimeout(
      () => {
        void saveRef.current()
      },
      isPresentingRef.current ? LIVE_AUTOSAVE_DELAY_MS : AUTOSAVE_DELAY_MS,
    )
    return () => clearTimeout(timer)
  }, [isDirty, savedSerialized])

  // Live presentation position for THIS song (index is into the server's
  // expanded slide list; null when this song isn't the one being projected).
  const presentedSlideIndex = useMemo(() => {
    const temp = presentationState?.temporaryContent
    if (temp?.type !== 'song' || temp.data.songId !== song.id) return null
    return temp.data.currentSlideIndex
  }, [presentationState, song.id])

  const presentedSlideId = useMemo(() => {
    const temp = presentationState?.temporaryContent
    if (temp?.type !== 'song' || temp.data.songId !== song.id) return null
    return temp.data.slides?.[temp.data.currentSlideIndex]?.id ?? null
  }, [presentationState, song.id])

  const isPresenting = presentedSlideIndex !== null
  // Read by the autosave timer, which is scheduled before this is known.
  const isPresentingRef = useRef(isPresenting)
  isPresentingRef.current = isPresenting
  // While a step of the selected program is live, Prev/Next walk the program.
  // When presenting, Prev/Next drive the live show (Next is allowed on the last
  // slide — the server ends the presentation). When NOT presenting they browse
  // the slides on the canvas, so keep them usable as long as there's more than
  // one slide (the editor clamps at the ends).
  const isProgramLive = scheduleNav.isScheduleLive
  const canNavigatePrev = isProgramLive
    ? scheduleNav.canNavigatePrev
    : isPresenting
      ? presentedSlideIndex > 0
      : slides.length > 1
  const canNavigateNext = isProgramLive
    ? scheduleNav.canNavigateNext
    : isPresenting || slides.length > 1

  // Bumped on each navigation (Present/Next/Prev). The stage editor watches this
  // to move its canvas selection — snapping to the live slide while presenting,
  // or stepping by `navDir` when nothing is projected. Projecting a single slide
  // (green thumbnail button) deliberately does NOT bump it, so it never moves
  // the slide being edited. `navDir` records the last direction (+1/-1), or 0
  // when the program moved the projector: the canvas follows it while it is on
  // this song and otherwise stays where it is.
  const [nav, setNav] = useState({ seq: 0, dir: 1 })
  const bumpNav = useCallback(
    (dir: number) => setNav((n) => ({ seq: n.seq + 1, dir })),
    [],
  )

  const [isStartingPresentation, setIsStartingPresentation] = useState(false)
  const handlePresent = useCallback(async () => {
    setIsStartingPresentation(true)
    try {
      await flushSave()
      await onPresentSlide(0)
      bumpNav(1)
    } finally {
      setIsStartingPresentation(false)
    }
  }, [flushSave, onPresentSlide, bumpNav])

  const handlePrev = useCallback(async () => {
    await flushSave()
    if (isProgramLive) {
      await scheduleNav.goPrev()
      bumpNav(0)
      return
    }
    if (isPresenting) {
      // Server clamps prev at the first slide (never closes), so don't gate on
      // the local slide index — a fast next→prev on a presenter remote would
      // otherwise no-op before the local index caught up.
      await navigateTemporary.mutateAsync({ direction: 'prev' })
      bumpNav(-1)
      return
    }
    if (slides.length > 1) bumpNav(-1)
  }, [
    flushSave,
    isProgramLive,
    scheduleNav,
    isPresenting,
    navigateTemporary,
    bumpNav,
    slides.length,
  ])

  const handleNext = useCallback(async () => {
    if (!canNavigateNext) return
    await flushSave()
    if (isProgramLive) {
      // Past this song's last slide comes the program's next item.
      await scheduleNav.goNext()
      bumpNav(0)
      return
    }
    if (isPresenting) await navigateTemporary.mutateAsync({ direction: 'next' })
    bumpNav(1)
  }, [
    flushSave,
    canNavigateNext,
    isProgramLive,
    scheduleNav,
    isPresenting,
    navigateTemporary,
    bumpNav,
  ])

  // Prev/Next pressed while a slide is being edited. Letting the press take the
  // focus ends edit mode on mousedown, the formatting bar goes away and the
  // stage reflows, so the button moves out from under the pointer and the click
  // never lands. The focus stays put instead; the slide change the click makes
  // ends editing anyway.
  const keepSlideEditorFocus = useCallback((event: React.MouseEvent) => {
    const editing = document.activeElement?.closest(
      '[data-testid="slide-canvas-editable"], [data-testid="slide-style-toolbar"]',
    )
    if (editing) event.preventDefault()
  }, [])

  const handleHide = useCallback(() => {
    void clearTemporary.mutateAsync()
  }, [clearTemporary])

  // Arrow keys drive the same handlers as the Next/Prev buttons so keyboard
  // navigation stays in sync with the canvas. Registered under a dedicated id
  // (the classic song page disables its own handler in PowerPoint mode).
  // Escape only hides when something is actually live.
  const handleEscape = useCallback(() => {
    if (!isPresenting) return false
    handleHide()
    return true
  }, [isPresenting, handleHide])
  useSongKeyboardShortcuts({
    id: 'song-stage-nav',
    onNextSlide: handleNext,
    onPreviousSlide: handlePrev,
    onHidePresentation: handleEscape,
  })

  // The song as the projector runs it (the server inserts choruses after
  // verses), built from the draft by position so every slide has a place in it
  // whether or not it has a stored id yet.
  const expandedSlides = useMemo(() => {
    const expandable: SongSlide[] = slides.map((s, i) => ({
      id: typeof s.id === 'number' ? s.id : -(i + 1),
      songId: song.id,
      content: s.content,
      chords: s.chords ?? null,
      sortOrder: i,
      label: s.label ?? null,
      notes: s.notes ?? null,
      styleOverrides: s.styleOverrides ?? null,
      createdAt: 0,
      updatedAt: 0,
    }))
    return expandSongSlidesWithChoruses(expandable)
  }, [slides, song.id])

  // Map each slide's position to its expanded display index, so a thumbnail
  // can be projected at the right index.
  const displayIndexByPosition = useMemo(() => {
    const map = new Map<number, number>()
    for (const es of expandedSlides) {
      if (!map.has(es.originalIndex)) map.set(es.originalIndex, es.displayIndex)
    }
    return map
  }, [expandedSlides])

  // And back: the position of the slide the projector is showing. Navigation
  // snaps the stage here, by position rather than by id, so it lands on the
  // right thumbnail even when the draft and the projector disagree on an id.
  const presentedSlidePosition =
    presentedSlideIndex === null
      ? null
      : (expandedSlides[presentedSlideIndex]?.originalIndex ?? null)

  // Project a slide to the screen without moving the slide being edited.
  const handleProjectSlide = useCallback(
    (index: number) => {
      const slideIndex = displayIndexByPosition.get(index) ?? index
      void flushSave().then(() => onPresentSlide(slideIndex))
    },
    [flushSave, displayIndexByPosition, onPresentSlide],
  )

  // The page's own "show the selected slide" shortcut (Settings → Shortcuts →
  // Songs): project the slide on the canvas, like its green button.
  const activeIndexRef = useRef(0)
  const handleShowActiveSlide = useCallback(() => {
    if (slides.length === 0) return
    handleProjectSlide(activeIndexRef.current)
  }, [slides.length, handleProjectSlide])
  usePageShortcutEvent('songs', 'showSlide', handleShowActiveSlide)

  // Speaker note for the slide currently on the canvas. Clamp the index so a
  // deletion can't point past the end of the list.
  const activeIndex =
    slides.length === 0 ? 0 : Math.min(activeSlideIndex, slides.length - 1)
  activeIndexRef.current = activeIndex
  const activeNote = slides[activeIndex]?.notes ?? ''
  const handleNoteChange = useCallback(
    (value: string) => {
      setSlides((prev) =>
        prev.map((s, i) => (i === activeIndex ? { ...s, notes: value } : s)),
      )
    },
    [activeIndex],
  )

  // Rewriting the active slide's text from the formatting bar — re-casing a
  // selection is an edit like any other, so it goes through the slide draft and
  // the same debounced autosave.
  const handleTextChange = useCallback(
    (plainText: string) => {
      setSlides((prev) =>
        prev.map((s, i) =>
          i === activeIndex
            ? { ...s, content: plainTextToSlideHtml(plainText) }
            : s,
        ),
      )
      // The in-place editor leaves its own DOM alone while the same slide is
      // open, so it has to be told this text did not come from typing.
      setTextVersion((version) => version + 1)
    },
    [activeIndex],
  )

  // Per-slide text styling. It rides along with the slide draft, so the same
  // debounced autosave that persists an edited lyric persists the styling.
  const activeStyleOverrides = slides[activeIndex]?.styleOverrides ?? null
  const handleStyleChange = useCallback(
    (override: SlideStyleOverride | null) => {
      setSlides((prev) =>
        prev.map((s, i) =>
          i === activeIndex ? { ...s, styleOverrides: override } : s,
        ),
      )
    },
    [activeIndex],
  )

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Toolbar: save status + present */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          {upsert.isPending ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {t('stageEditor.saving')}
            </>
          ) : isDirty ? (
            <span>{t('stageEditor.unsaved')}</span>
          ) : (
            <>
              <Check size={14} className="text-green-500" />
              {t('stageEditor.saved')}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPresenting && (
            <button
              type="button"
              onClick={handleHide}
              disabled={clearTemporary.isPending}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              data-testid="stage-hide"
            >
              <EyeOff size={16} />
              {t('stageEditor.hide')}
            </button>
          )}
          <button
            type="button"
            onClick={handlePresent}
            disabled={isStartingPresentation}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            data-testid="stage-present"
          >
            <Play size={16} />
            {t('stageEditor.present')}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <SongStageEditor
          slides={slides}
          title={song.title}
          keyLine={song.keyLine}
          songId={song.id}
          presentedSlideId={presentedSlideId}
          presentedSlidePosition={presentedSlidePosition}
          navSeq={nav.seq}
          navDir={nav.dir}
          isPresenting={isPresenting}
          clickToEdit
          onProjectSlide={handleProjectSlide}
          onActiveSlideChange={setActiveSlideIndex}
          onSlidesChange={setSlides}
          fillHeight
          textVersion={textVersion}
          canvasToolbar={
            <SlideStyleToolbar
              override={activeStyleOverrides}
              canvasWidth={canvasWidth}
              onChange={handleStyleChange}
              onTextChange={handleTextChange}
              disabled={slides.length === 0}
            />
          }
          canvasFooter={
            /* Presentation navigation hugs the bottom of the stage — advance/
               retreat the live slide. The slide counter is pinned left and the
               session clock right, on the same row. */
            <div className="relative flex w-full items-center justify-center gap-3 pt-3 shrink-0">
              <div className="absolute left-0 top-1/2 -translate-y-1/2">
                <SlideCounter
                  currentIndex={activeIndex}
                  total={slides.length}
                  variant="badge"
                />
              </div>
              <button
                type="button"
                onMouseDown={keepSlideEditorFocus}
                onClick={handlePrev}
                disabled={!canNavigatePrev || navigateTemporary.isPending}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                data-testid="stage-prev"
              >
                <ChevronLeft size={20} />
                <span className="text-sm">{t('bible:controls.prev')}</span>
              </button>
              <button
                type="button"
                onMouseDown={keepSlideEditorFocus}
                onClick={handleNext}
                disabled={!canNavigateNext || navigateTemporary.isPending}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                data-testid="stage-next"
              >
                <span className="text-sm">{t('bible:controls.next')}</span>
                <ChevronRight size={20} />
              </button>
              <div className="absolute right-0 top-1/2 -translate-y-1/2">
                <StageTimer />
              </div>
            </div>
          }
          columnFooter={
            /* Speaker notes pinned to the column footer (collapsed by default). */
            <SlideNotesPanel
              slideNumber={activeIndex + 1}
              note={activeNote}
              onChange={handleNoteChange}
            />
          }
        />
      </div>
    </div>
  )
}
