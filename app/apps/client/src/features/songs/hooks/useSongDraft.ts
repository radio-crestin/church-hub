import { useCallback, useEffect, useMemo, useState } from 'react'

import { useSong } from './useSong'
import { useUpsertSong } from './useUpsertSong'
import { defaultSongMetadata } from '../components/SongDetailsSection'
import type { SongWithSlides } from '../types'
import { draftSignature } from '../utils/draftSignature'
import { type SongDraft, songToDraft } from '../utils/songToDraft'

const EMPTY_DRAFT: SongDraft = {
  title: '',
  categoryId: null,
  tagIds: [],
  slides: [],
  metadata: defaultSongMetadata,
  background: null,
}

/**
 * The song editor's draft of one song (`songId` null: a new one): loaded once,
 * edited locally, stored only by `save`, which sends the whole song (slides
 * with their chords, labels, notes and styling, the details, the background).
 * `isDirty` says whether the draft differs from what was last loaded or saved.
 */
export function useSongDraft(songId: number | null) {
  const { data: song, isLoading } = useSong(songId)
  const upsert = useUpsertSong()
  const [draft, setDraft] = useState<SongDraft>(EMPTY_DRAFT)
  const [saved, setSaved] = useState<SongDraft | null>(
    songId === null ? EMPTY_DRAFT : null,
  )
  const [loadedId, setLoadedId] = useState<number | null>(null)

  // Seeded once per song: a refetch (after a save here or elsewhere) must not
  // throw away what is being typed.
  useEffect(() => {
    if (!song || song.id === loadedId) return
    const loaded = songToDraft(song)
    setDraft(loaded)
    setSaved(loaded)
    setLoadedId(song.id)
  }, [song, loadedId])

  const update = useCallback((patch: Partial<SongDraft>) => {
    setDraft((current) => ({ ...current, ...patch }))
  }, [])

  const isDirty = useMemo(
    () => saved === null || draftSignature(draft) !== draftSignature(saved),
    [draft, saved],
  )

  const save = useCallback(async (): Promise<SongWithSlides | null> => {
    if (!draft.title.trim()) return null
    const result = await upsert.mutateAsync({
      id: songId ?? undefined,
      title: draft.title.trim(),
      categoryId: draft.categoryId,
      tagIds: draft.tagIds,
      slides: draft.slides.map((s, index) => ({
        id: typeof s.id === 'number' ? s.id : undefined,
        content: s.content,
        chords: s.chords ?? null,
        sortOrder: index,
        label: s.label ?? null,
        notes: s.notes ?? null,
        styleOverrides: s.styleOverrides ?? null,
      })),
      ...draft.metadata,
      // null clears it, so the screens' own backgrounds apply again
      background: draft.background,
    })
    if (!result.success || !result.data) return null
    const stored = songToDraft(result.data)
    setDraft(stored)
    setSaved(stored)
    setLoadedId(result.data.id)
    return result.data
  }, [draft, songId, upsert])

  return {
    song: song ?? null,
    draft,
    update,
    isLoading: songId !== null && (isLoading || saved === null),
    isDirty,
    save,
    isSaving: upsert.isPending,
  }
}
