import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, FileQuestion, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import { useDeleteSong, useSongs } from '../../hooks'
import { deleteUncategorizedSongs } from '../../service'
import type { Song } from '../../types'

export function UncategorizedSongsCard() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const { data: songs } = useSongs()
  const deleteSong = useDeleteSong()

  const [isExpanded, setIsExpanded] = useState(false)
  const [songToDelete, setSongToDelete] = useState<{
    id: number
    title: string
  } | null>(null)
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false)
  const [isDeletingAll, setIsDeletingAll] = useState(false)

  const uncategorizedSongs = useMemo(
    () => songs?.filter((song: Song) => song.categoryId === null) ?? [],
    [songs],
  )

  const handleDelete = async () => {
    if (!songToDelete) return

    const success = await deleteSong.mutateAsync(songToDelete.id)
    if (success) {
      setSongToDelete(null)
      showToast(t('sections.categories.uncategorized.toast.deleted'), 'success')
    } else {
      showToast(t('sections.categories.toast.error'), 'error')
    }
  }

  const handleDeleteAll = async () => {
    setIsDeletingAll(true)

    const result = await deleteUncategorizedSongs()

    setIsDeletingAll(false)
    setShowDeleteAllModal(false)

    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ['songs'] })
      showToast(
        t('sections.categories.uncategorized.toast.deletedAll', {
          count: result.deletedCount,
        }),
        'success',
      )
    } else {
      showToast(t('sections.categories.toast.error'), 'error')
    }
  }

  if (uncategorizedSongs.length === 0) {
    return null
  }

  return (
    <>
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-3 p-3">
          <FileQuestion
            size={20}
            className="text-amber-600 dark:text-amber-400 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-900 dark:text-white block">
              {t('sections.categories.uncategorized.title')}
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-400">
              {t('sections.categories.uncategorized.count', {
                count: uncategorizedSongs.length,
              })}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteAllModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 rounded transition-colors shrink-0"
            title={t('sections.categories.uncategorized.deleteAll')}
          >
            <Trash2 size={14} />
            {t('sections.categories.uncategorized.deleteAll')}
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded transition-colors shrink-0"
          >
            {isExpanded ? (
              <ChevronUp size={20} className="text-gray-400" />
            ) : (
              <ChevronDown size={20} className="text-gray-400" />
            )}
          </button>
        </div>

        {isExpanded && (
          <div className="border-t border-amber-200 dark:border-amber-800 p-3 max-h-48 overflow-y-auto space-y-2">
            {uncategorizedSongs.map((song) => (
              <div
                key={song.id}
                className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
              >
                <span className="flex-1 text-sm text-gray-900 dark:text-white truncate">
                  {song.title}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSongToDelete({ id: song.id, title: song.title })
                  }
                  className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors shrink-0"
                  title={t('sections.categories.uncategorized.deleteSong')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {songToDelete && (
        <ConfirmModal
          isOpen={true}
          title={t('sections.categories.uncategorized.modals.delete.title')}
          message={t(
            'sections.categories.uncategorized.modals.delete.message',
            {
              name: songToDelete.title,
            },
          )}
          confirmLabel={t(
            'sections.categories.uncategorized.modals.delete.confirm',
          )}
          cancelLabel={t('common:buttons.cancel', 'Cancel')}
          onConfirm={handleDelete}
          onCancel={() => setSongToDelete(null)}
          variant="danger"
        />
      )}

      {showDeleteAllModal && (
        <ConfirmModal
          isOpen={true}
          title={t('sections.categories.uncategorized.modals.deleteAll.title')}
          message={t(
            'sections.categories.uncategorized.modals.deleteAll.message',
            {
              count: uncategorizedSongs.length,
            },
          )}
          confirmLabel={
            isDeletingAll
              ? t('sections.categories.uncategorized.modals.deleteAll.deleting')
              : t(
                  'sections.categories.uncategorized.modals.deleteAll.confirm',
                  { count: uncategorizedSongs.length },
                )
          }
          cancelLabel={t('common:buttons.cancel', 'Cancel')}
          onConfirm={handleDeleteAll}
          onCancel={() => setShowDeleteAllModal(false)}
          variant="danger"
          isLoading={isDeletingAll}
        />
      )}
    </>
  )
}
