import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SongEditor } from '~/features/songs/components'
import { type LocalSlide } from '~/features/songs/components/SongSlideList'
import { useDeleteSong, useSong, useUpsertSong } from '~/features/songs/hooks'
import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'

export const Route = createFileRoute('/songs/$songId')({
  component: SongEditorPage,
})

function SongEditorPage() {
  const { t } = useTranslation(['songs', 'common'])
  const navigate = useNavigate()
  const { songId } = Route.useParams()
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
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Initialize local state when song is loaded
  useEffect(() => {
    if (song) {
      setTitle(song.title)
      setCategoryId(song.categoryId)
      setSlides(
        song.slides.map((s) => ({
          id: s.id,
          content: s.content,
          sortOrder: s.sortOrder,
        })),
      )
    }
  }, [song])

  const handleSave = useCallback(async () => {
    if (!title.trim()) return

    const result = await upsertMutation.mutateAsync({
      id: numericId ?? undefined,
      title: title.trim(),
      categoryId,
      slides: slides.map((s, idx) => ({
        id: typeof s.id === 'number' ? s.id : undefined,
        content: s.content,
        sortOrder: idx,
      })),
    })

    if (result.success && result.data) {
      showToast(t('songs:messages.saved'), 'success')

      if (isNew) {
        navigate({
          to: '/songs/$songId',
          params: { songId: String(result.data.id) },
        })
      } else {
        // Update local state with saved data
        setSlides(
          result.data.slides.map((s) => ({
            id: s.id,
            content: s.content,
            sortOrder: s.sortOrder,
          })),
        )
      }
    } else {
      showToast(t('songs:messages.error'), 'error')
    }
  }, [
    title,
    categoryId,
    slides,
    numericId,
    isNew,
    upsertMutation,
    showToast,
    t,
    navigate,
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

  const handleDeleteConfirm = async () => {
    if (!numericId) return

    setShowDeleteModal(false)
    const success = await deleteMutation.mutateAsync(numericId)
    if (success) {
      showToast(t('songs:messages.deleted'), 'success')
      navigate({ to: '/songs' })
    } else {
      showToast(t('songs:messages.error'), 'error')
    }
  }

  const isLoadingData = !isNew && isLoading

  return (
    <>
      <SongEditor
        isNew={isNew}
        isLoading={isLoadingData}
        isSaving={upsertMutation.isPending}
        isDeleting={deleteMutation.isPending}
        songId={numericId}
        title={title}
        categoryId={categoryId}
        slides={slides}
        onTitleChange={setTitle}
        onCategoryChange={setCategoryId}
        onSlidesChange={setSlides}
        onSave={handleSave}
        onDelete={isNew ? undefined : () => setShowDeleteModal(true)}
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
    </>
  )
}
