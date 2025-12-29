import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SongEditor, UnsavedChangesModal } from '~/features/songs/components'
import { type LocalSlide } from '~/features/songs/components/SongSlideList'
import {
  useDeleteSong,
  useDirtyState,
  useSong,
  useUnsavedChangesGuard,
  useUpsertSong,
} from '~/features/songs/hooks'
import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'

interface SongSearchParams {
  q?: string
}

interface SongMetadata {
  author: string | null
  copyright: string | null
  ccli: string | null
  key: string | null
  tempo: string | null
  timeSignature: string | null
  theme: string | null
  altTheme: string | null
  hymnNumber: string | null
  keyLine: string | null
  presentationOrder: string | null
  sourceFilename: string | null
}

const defaultMetadata: SongMetadata = {
  author: null,
  copyright: null,
  ccli: null,
  key: null,
  tempo: null,
  timeSignature: null,
  theme: null,
  altTheme: null,
  hymnNumber: null,
  keyLine: null,
  presentationOrder: null,
  sourceFilename: null,
}

export const Route = createFileRoute('/songs/$songId/edit')({
  component: SongEditorPage,
  validateSearch: (search: Record<string, unknown>): SongSearchParams => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
})

function SongEditorPage() {
  const { t } = useTranslation(['songs', 'common'])
  const navigate = useNavigate()
  const { songId } = Route.useParams()
  const { q: searchQuery } = useSearch({ from: '/songs/$songId/edit' })
  const { showToast } = useToast()

  const isNew = songId === 'new'
  const numericId = isNew ? null : parseInt(songId, 10)

  const { data: song, isLoading } = useSong(numericId)
  const upsertMutation = useUpsertSong()
  const deleteMutation = useDeleteSong()

  // Local state for editing
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [slides, setSlides] = useState<LocalSlide[]>([])
  const [metadata, setMetadata] = useState<SongMetadata>(defaultMetadata)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Track dirty state for save button and navigation blocking
  const { setSavedState, isDirty } = useDirtyState()
  const hasUnsavedChanges = isDirty({ title, categoryId, slides, metadata })

  // Initialize local state when song is loaded
  useEffect(() => {
    if (song) {
      setTitle(song.title)
      setCategoryId(song.categoryId)
      const mappedSlides = song.slides.map((s) => ({
        id: s.id,
        content: s.content,
        sortOrder: s.sortOrder,
        label: s.label,
      }))
      setSlides(mappedSlides)

      const loadedMetadata: SongMetadata = {
        author: song.author,
        copyright: song.copyright,
        ccli: song.ccli,
        key: song.key,
        tempo: song.tempo,
        timeSignature: song.timeSignature,
        theme: song.theme,
        altTheme: song.altTheme,
        hymnNumber: song.hymnNumber,
        keyLine: song.keyLine,
        presentationOrder: song.presentationOrder,
        sourceFilename: song.sourceFilename,
      }
      setMetadata(loadedMetadata)

      // Save initial state for dirty comparison
      setSavedState({
        title: song.title,
        categoryId: song.categoryId,
        slides: mappedSlides,
        metadata: loadedMetadata,
      })
    }
  }, [song, setSavedState])

  const handleMetadataChange = useCallback(
    (field: keyof SongMetadata, value: string | null) => {
      setMetadata((prev) => ({ ...prev, [field]: value }))
    },
    [],
  )

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!title.trim()) return false

    const result = await upsertMutation.mutateAsync({
      id: numericId ?? undefined,
      title: title.trim(),
      categoryId,
      slides: slides.map((s, idx) => ({
        id: typeof s.id === 'number' ? s.id : undefined,
        content: s.content,
        sortOrder: idx,
        label: s.label,
      })),
      // Include metadata fields
      author: metadata.author,
      copyright: metadata.copyright,
      ccli: metadata.ccli,
      key: metadata.key,
      tempo: metadata.tempo,
      timeSignature: metadata.timeSignature,
      theme: metadata.theme,
      altTheme: metadata.altTheme,
      hymnNumber: metadata.hymnNumber,
      keyLine: metadata.keyLine,
      presentationOrder: metadata.presentationOrder,
      sourceFilename: metadata.sourceFilename,
    })

    if (result.success && result.data) {
      showToast(t('songs:messages.saved'), 'success')

      // Update saved state after successful save
      const savedSlides = result.data.slides.map((s) => ({
        id: s.id,
        content: s.content,
        sortOrder: s.sortOrder,
        label: s.label,
      }))
      const savedMetadata: SongMetadata = {
        author: result.data.author,
        copyright: result.data.copyright,
        ccli: result.data.ccli,
        key: result.data.key,
        tempo: result.data.tempo,
        timeSignature: result.data.timeSignature,
        theme: result.data.theme,
        altTheme: result.data.altTheme,
        hymnNumber: result.data.hymnNumber,
        keyLine: result.data.keyLine,
        presentationOrder: result.data.presentationOrder,
        sourceFilename: result.data.sourceFilename,
      }
      setSavedState({
        title: result.data.title,
        categoryId: result.data.categoryId,
        slides: savedSlides,
        metadata: savedMetadata,
      })

      if (isNew) {
        // Navigate to the preview page after creating a new song
        navigate({
          to: '/songs/$songId',
          params: { songId: String(result.data.id) },
        })
      } else {
        // Update local state with saved data
        setSlides(savedSlides)
        setMetadata(savedMetadata)
      }
      return true
    } else {
      showToast(t('songs:messages.error'), 'error')
      return false
    }
  }, [
    title,
    categoryId,
    slides,
    metadata,
    numericId,
    isNew,
    upsertMutation,
    showToast,
    t,
    navigate,
    setSavedState,
  ])

  // CMD+S / Ctrl+S keyboard shortcut to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (!upsertMutation.isPending) {
          handleSave()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, upsertMutation.isPending])

  const handleBack = useCallback(() => {
    if (isNew) {
      // Go back to songs list for new songs
      navigate({ to: '/songs/', search: { q: searchQuery } })
    } else {
      // Go back to preview page for existing songs
      navigate({ to: '/songs/$songId', params: { songId } })
    }
  }, [navigate, searchQuery, songId, isNew])

  const handleDeleteConfirm = async () => {
    if (!numericId) return

    setShowDeleteModal(false)
    const success = await deleteMutation.mutateAsync(numericId)
    if (success) {
      showToast(t('songs:messages.deleted'), 'success')
      // Navigate to songs list after deletion
      navigate({ to: '/songs/', search: { q: searchQuery } })
    } else {
      showToast(t('songs:messages.error'), 'error')
    }
  }

  // Navigation blocking for unsaved changes
  const {
    showModal: showUnsavedModal,
    handleCancel: handleUnsavedCancel,
    handleDiscard: handleUnsavedDiscard,
  } = useUnsavedChangesGuard({
    isDirty: hasUnsavedChanges,
  })

  const isLoadingData = !isNew && isLoading

  return (
    <>
      <SongEditor
        isNew={isNew}
        isLoading={isLoadingData}
        isSaving={upsertMutation.isPending}
        isDeleting={deleteMutation.isPending}
        isDirty={hasUnsavedChanges}
        songId={numericId}
        title={title}
        categoryId={categoryId}
        slides={slides}
        metadata={metadata}
        presentationCount={song?.presentationCount}
        lastManualEdit={song?.lastManualEdit}
        onTitleChange={setTitle}
        onCategoryChange={setCategoryId}
        onSlidesChange={setSlides}
        onMetadataChange={handleMetadataChange}
        onSave={handleSave}
        onDelete={isNew ? undefined : () => setShowDeleteModal(true)}
        onBack={handleBack}
      />

      <ConfirmModal
        isOpen={showDeleteModal}
        title={t('songs:modal.deleteTitle')}
        message={t('songs:modal.deleteMessage')}
        confirmLabel={t('songs:actions.delete')}
        cancelLabel={t('common:buttons.cancel')}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteModal(false)}
        variant="danger"
      />

      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onDiscard={handleUnsavedDiscard}
        onCancel={handleUnsavedCancel}
      />
    </>
  )
}
