import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  FileUp,
  ListPlus,
  Loader2,
  Play,
  Save,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAddToQueue } from '~/features/queue'
import { useToast } from '~/ui/toast'
import { CategoryPicker } from './CategoryPicker'
import { ImportTextModal } from './ImportTextModal'
import { type LocalSlide, SongSlideList } from './SongSlideList'

interface SongEditorProps {
  isNew: boolean
  isLoading?: boolean
  isSaving: boolean
  isDeleting?: boolean
  songId: number | null
  title: string
  categoryId: number | null
  slides: LocalSlide[]
  onTitleChange: (title: string) => void
  onCategoryChange: (categoryId: number | null) => void
  onSlidesChange: (slides: LocalSlide[]) => void
  onSave: () => void
  onDelete?: () => void
}

export function SongEditor({
  isNew,
  isLoading,
  isSaving,
  isDeleting,
  songId,
  title,
  categoryId,
  slides,
  onTitleChange,
  onCategoryChange,
  onSlidesChange,
  onSave,
  onDelete,
}: SongEditorProps) {
  const { t } = useTranslation(['songs', 'queue'])
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [showImportModal, setShowImportModal] = useState(false)
  const addToQueueMutation = useAddToQueue()

  const handleAddToQueue = async () => {
    if (!songId) return

    const result = await addToQueueMutation.mutateAsync({ songId })
    if (result.success) {
      showToast(t('queue:messages.added'), 'success')
    } else {
      showToast(t('queue:messages.error'), 'error')
    }
  }

  const handlePresentNow = async () => {
    if (!songId) return

    const result = await addToQueueMutation.mutateAsync({
      songId,
      presentNow: true,
    })
    if (result.success) {
      showToast(t('queue:messages.presenting'), 'success')
      navigate({ to: '/present' })
    } else {
      showToast(t('queue:messages.error'), 'error')
    }
  }

  const handleImport = (slideContents: string[]) => {
    const newSlides: LocalSlide[] = slideContents.map((content, idx) => ({
      id: `temp-${Date.now()}-${idx}`,
      content: `<p>${content.replace(/\n/g, '<br>')}</p>`,
      sortOrder: slides.length + idx,
    }))
    onSlidesChange([...slides, ...newSlides])
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/songs"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isLoading ? (
              <span className="inline-block w-48 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ) : isNew ? (
              t('actions.create')
            ) : (
              title || t('editor.titlePlaceholder')
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting || isLoading}
              className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              title={t('songs:actions.delete')}
            >
              {isDeleting ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Trash2 size={20} />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || isLoading || !title.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Save size={20} />
            )}
            {t('songs:actions.save')}
          </button>
          {!isNew && songId && (
            <>
              <button
                type="button"
                onClick={handleAddToQueue}
                disabled={isLoading || addToQueueMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
                title={t('queue:actions.addToQueue')}
              >
                {addToQueueMutation.isPending ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <ListPlus size={20} />
                )}
                <span className="hidden sm:inline">
                  {t('queue:actions.addToQueue')}
                </span>
              </button>
              <button
                type="button"
                onClick={handlePresentNow}
                disabled={isLoading || addToQueueMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                title={t('queue:actions.presentNow')}
              >
                <Play size={20} />
                <span className="hidden sm:inline">
                  {t('queue:actions.presentNow')}
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Song Details */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('editor.titlePlaceholder').replace('...', '')}
            </label>
            {isLoading ? (
              <div className="w-full h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            ) : (
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white"
                placeholder={t('editor.titlePlaceholder')}
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('category.name')}
            </label>
            {isLoading ? (
              <div className="w-full h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            ) : (
              <CategoryPicker value={categoryId} onChange={onCategoryChange} />
            )}
          </div>
        </div>
      </div>

      {/* Slides Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('editor.slides')} ({isLoading ? '-' : slides.length})
          </h2>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            <FileUp className="w-4 h-4" />
            {t('actions.import')}
          </button>
        </div>
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          </div>
        ) : (
          <SongSlideList slides={slides} onSlidesChange={onSlidesChange} />
        )}
      </div>

      <ImportTextModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
      />
    </div>
  )
}
