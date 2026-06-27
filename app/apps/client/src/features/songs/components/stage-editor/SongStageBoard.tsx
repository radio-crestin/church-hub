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
import { SongStageEditor } from './SongStageEditor'
import { useUpsertSong } from '../../hooks'
import type { SongWithSlides } from '../../types'
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
  }))
}

/** Stable signature of the editable parts of the slides, for dirty detection. */
function serialize(slides: LocalSlide[]): string {
  return JSON.stringify(
    slides.map((s) => ({
      content: s.content,
      label: s.label ?? null,
      chords: s.chords ?? null,
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
  const canNavigatePrev = isPresenting && presentedSlideIndex > 0
  // Next is allowed even on the last slide — the server ends the presentation.
  const canNavigateNext = isPresenting

  const handlePresent = useCallback(() => {
    void presentSong.mutateAsync({ songId: song.id, slideIndex: 0 })
  }, [presentSong, song.id])

  const handlePrev = useCallback(() => {
    if (canNavigatePrev)
      void navigateTemporary.mutateAsync({ direction: 'prev' })
  }, [canNavigatePrev, navigateTemporary])

  const handleNext = useCallback(() => {
    if (canNavigateNext)
      void navigateTemporary.mutateAsync({ direction: 'next' })
  }, [canNavigateNext, navigateTemporary])

  const handleHide = useCallback(() => {
    void clearTemporary.mutateAsync()
  }, [clearTemporary])

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

      <div className="flex-1 min-h-0 overflow-y-auto">
        <SongStageEditor
          slides={slides}
          title={song.title}
          keyLine={song.keyLine}
          songId={song.id}
          presentedSlideId={presentedSlideId}
          onSlidesChange={setSlides}
        />
      </div>

      {/* Bottom presentation navigation — advance/retreat the live slide. */}
      <div className="flex items-center justify-center gap-3 pt-3 shrink-0">
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
      </div>
    </div>
  )
}
