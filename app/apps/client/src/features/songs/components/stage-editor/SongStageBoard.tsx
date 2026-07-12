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

import {
  useClearTemporaryContent,
  useNavigateTemporary,
  usePresentationState,
  usePresentTemporarySong,
} from '~/features/presentation'
import { SlideNotesPanel } from './SlideNotesPanel'
import { SongStageEditor } from './SongStageEditor'
import { StageTimer } from './StageTimer'
import { useSongKeyboardShortcuts, useUpsertSong } from '../../hooks'
import type { SongSlide, SongWithSlides } from '../../types'
import { expandSongSlidesWithChoruses } from '../../utils/expandSongSlides'
import { type LocalSlide } from '../SongSlideList'

interface SongStageBoardProps {
  song: SongWithSlides
}

const AUTOSAVE_DELAY_MS = 1000

function mapSlides(song: SongWithSlides): LocalSlide[] {
  return song.slides.map((s) => ({
    id: s.id,
    content: s.content,
    chords: s.chords,
    sortOrder: s.sortOrder,
    label: s.label,
    notes: s.notes,
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
    })),
  )
}

/**
 * PowerPoint-layout editing surface shown directly on the song page. Owns the
 * editable slide draft, autosaves changes (slides-only — the server preserves
 * the rest of the song's metadata), and lets the operator present from the start.
 */
export function SongStageBoard({ song }: SongStageBoardProps) {
  const { t } = useTranslation(['songs', 'bible'])
  const upsert = useUpsertSong()
  const presentSong = usePresentTemporarySong()
  const navigateTemporary = useNavigateTemporary()
  const clearTemporary = useClearTemporaryContent()
  const { data: presentationState } = usePresentationState()

  const [slides, setSlides] = useState<LocalSlide[]>(() => mapSlides(song))
  const [savedSerialized, setSavedSerialized] = useState(() =>
    serialize(mapSlides(song)),
  )
  // Which slide the canvas is on — drives the speaker-notes panel below it.
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)

  // Re-seed the draft only when navigating to a different song, never on the
  // refetch that follows an autosave (that would clobber in-progress edits).
  const loadedSongIdRef = useRef(song.id)
  useEffect(() => {
    if (loadedSongIdRef.current !== song.id) {
      loadedSongIdRef.current = song.id
      const fresh = mapSlides(song)
      setSlides(fresh)
      setSavedSerialized(serialize(fresh))
    }
  }, [song])

  const currentSerialized = serialize(slides)
  const isDirty = currentSerialized !== savedSerialized

  // Debounced autosave: persist slides ~1s after the last edit.
  useEffect(() => {
    if (!isDirty) return
    const timer = setTimeout(() => {
      upsert.mutate(
        {
          id: song.id,
          title: song.title,
          slides: slides.map((s, idx) => ({
            id: typeof s.id === 'number' ? s.id : undefined,
            content: s.content,
            chords: s.chords,
            sortOrder: idx,
            label: s.label,
            notes: s.notes,
          })),
        },
        { onSuccess: () => setSavedSerialized(currentSerialized) },
      )
    }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isDirty, currentSerialized, slides, song.id, song.title, upsert])

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
  // When presenting, Prev/Next drive the live show (Next is allowed on the last
  // slide — the server ends the presentation). When NOT presenting they browse
  // the slides on the canvas, so keep them usable as long as there's more than
  // one slide (the editor clamps at the ends).
  const canNavigatePrev = isPresenting
    ? presentedSlideIndex > 0
    : slides.length > 1
  const canNavigateNext = isPresenting || slides.length > 1

  // Bumped on each navigation (Present/Next/Prev). The stage editor watches this
  // to move its canvas selection — snapping to the live slide while presenting,
  // or stepping by `navDir` when nothing is projected. Projecting a single slide
  // (green thumbnail button) deliberately does NOT bump it, so it never moves
  // the slide being edited. `navDir` records the last direction (+1/-1).
  const [nav, setNav] = useState({ seq: 0, dir: 1 })
  const bumpNav = useCallback(
    (dir: number) => setNav((n) => ({ seq: n.seq + 1, dir })),
    [],
  )

  const handlePresent = useCallback(async () => {
    await presentSong.mutateAsync({ songId: song.id, slideIndex: 0 })
    bumpNav(1)
  }, [presentSong, song.id, bumpNav])

  const handlePrev = useCallback(async () => {
    if (!canNavigatePrev) return
    if (isPresenting) await navigateTemporary.mutateAsync({ direction: 'prev' })
    bumpNav(-1)
  }, [canNavigatePrev, isPresenting, navigateTemporary, bumpNav])

  const handleNext = useCallback(async () => {
    if (!canNavigateNext) return
    if (isPresenting) await navigateTemporary.mutateAsync({ direction: 'next' })
    bumpNav(1)
  }, [canNavigateNext, isPresenting, navigateTemporary, bumpNav])

  const handleHide = useCallback(() => {
    void clearTemporary.mutateAsync()
  }, [clearTemporary])

  // Arrow keys drive the same handlers as the Next/Prev buttons so keyboard
  // navigation stays in sync with the canvas. Registered under a dedicated id
  // (the classic song page disables its own handler in PowerPoint mode).
  // Escape only hides when something is actually live.
  const handleEscape = useCallback(() => {
    if (isPresenting) handleHide()
  }, [isPresenting, handleHide])
  useSongKeyboardShortcuts({
    id: 'song-stage-nav',
    onNextSlide: handleNext,
    onPreviousSlide: handlePrev,
    onHidePresentation: handleEscape,
  })

  // Map each slide's position to its expanded display index (the server inserts
  // choruses after verses), so a thumbnail can be projected at the right index.
  const displayIndexByPosition = useMemo(() => {
    const expandable: SongSlide[] = slides.map((s, i) => ({
      id: typeof s.id === 'number' ? s.id : -(i + 1),
      songId: song.id,
      content: s.content,
      chords: s.chords ?? null,
      sortOrder: i,
      label: s.label ?? null,
      notes: s.notes ?? null,
      createdAt: 0,
      updatedAt: 0,
    }))
    const map = new Map<number, number>()
    for (const es of expandSongSlidesWithChoruses(expandable)) {
      if (!map.has(es.originalIndex)) map.set(es.originalIndex, es.displayIndex)
    }
    return map
  }, [slides, song.id])

  // Project a slide to the screen without moving the slide being edited.
  const handleProjectSlide = useCallback(
    (index: number) => {
      const slideIndex = displayIndexByPosition.get(index) ?? index
      void presentSong.mutateAsync({ songId: song.id, slideIndex })
    },
    [displayIndexByPosition, presentSong, song.id],
  )

  // Speaker note for the slide currently on the canvas. Clamp the index so a
  // deletion can't point past the end of the list.
  const activeIndex =
    slides.length === 0 ? 0 : Math.min(activeSlideIndex, slides.length - 1)
  const activeNote = slides[activeIndex]?.notes ?? ''
  const handleNoteChange = useCallback(
    (value: string) => {
      setSlides((prev) =>
        prev.map((s, i) => (i === activeIndex ? { ...s, notes: value } : s)),
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
            disabled={presentSong.isPending}
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
          navSeq={nav.seq}
          navDir={nav.dir}
          isPresenting={isPresenting}
          clickToEdit
          onProjectSlide={handleProjectSlide}
          onActiveSlideChange={setActiveSlideIndex}
          onSlidesChange={setSlides}
          fillHeight
          canvasFooter={
            /* Presentation navigation sits under the canvas only, not the
               filmstrip — advance/retreat the live slide. The session clock is
               pinned bottom-right of the canvas column. */
            <div className="relative flex items-center justify-center gap-3 pt-3 shrink-0">
              <button
                type="button"
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
        />
      </div>

      {/* Speaker notes for the selected slide, pinned below the editor so it
          stays visible and resizable whatever the filmstrip/column layout —
          the editor area above shrinks (and scrolls) as the panel grows. */}
      <SlideNotesPanel
        slideNumber={activeIndex + 1}
        note={activeNote}
        onChange={handleNoteChange}
      />
    </div>
  )
}
