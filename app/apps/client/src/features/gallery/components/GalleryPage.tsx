import { Info, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  useBackgroundMediaList,
  useDeleteBackgroundMedia,
} from '~/features/background-media/hooks'
import type { BackgroundMedia } from '~/features/background-media/service/types'
import { ConfirmModal } from '~/ui/modal'
import { useHasPermission } from '~/ui/PermissionGate'
import { useToast } from '~/ui/toast'
import { createLogger } from '~/utils/logger'
import { GalleryEmptyState } from './GalleryEmptyState'
import { GalleryFilterTabs } from './GalleryFilterTabs'
import { GalleryItemCard } from './GalleryItemCard'
import { GalleryPreviewModal } from './GalleryPreviewModal'
import { GalleryUploadButton } from './GalleryUploadButton'
import { useGalleryUpload } from '../hooks/useGalleryUpload'
import type { GalleryFilter } from '../types'

const logger = createLogger('app:gallery')

/**
 * Every uploaded image and video in one place: upload several at once, filter
 * by kind, preview at full size and delete. The same files are offered as
 * screen and song backgrounds.
 */
export function GalleryPage() {
  const { t } = useTranslation('gallery')
  const { showToast } = useToast()
  const canEdit = useHasPermission('displays.edit')
  const {
    data: media = [],
    isLoading,
    isError,
    refetch,
  } = useBackgroundMediaList()
  const deleteMutation = useDeleteBackgroundMedia()
  const { uploadFiles, progress, heavyGifWarning } = useGalleryUpload()
  const [filter, setFilter] = useState<GalleryFilter>('all')
  const [previewMedia, setPreviewMedia] = useState<BackgroundMedia | null>(null)
  const [pendingDelete, setPendingDelete] = useState<BackgroundMedia | null>(
    null,
  )

  const counts = useMemo<Record<GalleryFilter, number>>(
    () => ({
      all: media.length,
      image: media.filter((item) => item.kind === 'image').length,
      video: media.filter((item) => item.kind === 'video').length,
    }),
    [media],
  )

  const items =
    filter === 'all' ? media : media.filter((item) => item.kind === filter)

  const confirmDelete = () => {
    if (!pendingDelete) return
    const target = pendingDelete
    setPendingDelete(null)

    deleteMutation.mutate(target.id, {
      onError: (error) => {
        logger.error(`Delete of ${target.id} failed`, error)
        showToast(t('delete.failed'), 'error')
      },
    })
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      )
    }

    if (isError) {
      return (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-red-600 dark:text-red-400">
            {t('errors.loadFailed')}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            {t('common:buttons.retry')}
          </button>
        </div>
      )
    }

    if (items.length === 0) {
      return <GalleryEmptyState filter={filter} />
    }

    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {items.map((item) => (
          <GalleryItemCard
            key={item.id}
            media={item}
            onPreview={() => setPreviewMedia(item)}
            onDelete={canEdit ? () => setPendingDelete(item) : undefined}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      data-testid="gallery-page"
      className="flex h-full flex-col overflow-x-hidden"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-gray-200 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-gray-700">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('description')}
          </p>
        </div>
        {canEdit && (
          <GalleryUploadButton
            progress={progress}
            onFilesSelected={(files) => void uploadFiles(files)}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <GalleryFilterTabs
            value={filter}
            counts={counts}
            onChange={setFilter}
          />
          <p className="flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('usageNote')}
          </p>
        </div>

        {renderContent()}
      </div>

      <GalleryPreviewModal
        media={previewMedia}
        onClose={() => setPreviewMedia(null)}
      />

      <ConfirmModal
        isOpen={pendingDelete !== null}
        title={t('delete.confirmTitle')}
        message={t('delete.confirmMessage')}
        confirmLabel={t('delete.confirm')}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {heavyGifWarning}
    </div>
  )
}
