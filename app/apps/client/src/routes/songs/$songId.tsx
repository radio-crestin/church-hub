import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SongEditor } from '~/features/songs/components'
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

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [savedTitle, setSavedTitle] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    if (song) {
      setTitle(song.title)
      setContent(song.content)
      setSavedTitle(song.title)
      setSavedContent(song.content)
    }
  }, [song])

  // Auto-extract title from first line for new songs
  useEffect(() => {
    if (!isNew || title.trim().length > 0) return

    // Parse HTML content to get first line text
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = content

    // Get text from first paragraph
    const firstParagraph = tempDiv.querySelector('p')
    if (!firstParagraph) return

    const firstLineText = firstParagraph.textContent || ''
    if (!firstLineText.trim()) return

    // Extract only letters and spaces (remove numbers and special characters)
    const lettersOnly = firstLineText
      .replace(/[^a-zA-ZăâîșțĂÂÎȘȚ\s]/g, '')
      .trim()
    if (lettersOnly.length > 0) {
      setTitle(lettersOnly)
    }
  }, [isNew, content, title])

  const hasChanges = useMemo(() => {
    if (isNew) {
      return title.trim().length > 0 || content.length > 0
    }
    return title !== savedTitle || content !== savedContent
  }, [isNew, title, content, savedTitle, savedContent])

  const handleSave = async () => {
    if (!title.trim() || !hasChanges) return

    const result = await upsertMutation.mutateAsync({
      id: numericId ?? undefined,
      title: title.trim(),
      content,
    })

    if (result.success) {
      showToast(t('songs:messages.saved'), 'success')
      setSavedTitle(title.trim())
      setSavedContent(content)

      if (result.id && isNew) {
        navigate({
          to: '/songs/$songId',
          params: { songId: String(result.id) },
        })
      }
    } else {
      showToast(t('songs:messages.error'), 'error')
    }
  }

  const handleDeleteClick = () => {
    setShowDeleteModal(true)
  }

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

  if (!isNew && isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6" />
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate({ to: '/songs' })}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('songs:actions.back')}
          </button>

          <div className="flex items-center gap-2">
            {!isNew && (
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={deleteMutation.isPending}
                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                title={t('songs:actions.delete')}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={
                !title.trim() || !hasChanges || upsertMutation.isPending
              }
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {t('songs:actions.save')}
            </button>
          </div>
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('songs:editor.titlePlaceholder')}
          className="w-full px-4 py-3 text-2xl font-bold bg-transparent border-b-2 border-gray-200 dark:border-gray-700 focus:border-indigo-500 dark:focus:border-indigo-400 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none transition-colors"
        />

        <SongEditor content={content} onContentChange={setContent} />
      </div>

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
