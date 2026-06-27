import { Check, Loader2, Play } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
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
  const { t } = useTranslation('songs')
  const upsert = useUpsertSong()
  const presentSong = usePresentTemporarySong()
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

  const presentedSlideId = useMemo(() => {
    const temp = presentationState?.temporaryContent
    if (temp?.type !== 'song' || temp.data.songId !== song.id) return null
    return temp.data.slides?.[temp.data.currentSlideIndex]?.id ?? null
  }, [presentationState, song.id])

  const handlePresent = useCallback(() => {
    void presentSong.mutateAsync({ songId: song.id, slideIndex: 0 })
  }, [presentSong, song.id])

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
        <button
          type="button"
          onClick={handlePresent}
          disabled={presentSong.isPending}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <Play size={16} />
          {t('stageEditor.present')}
        </button>
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
    </div>
  )
}
