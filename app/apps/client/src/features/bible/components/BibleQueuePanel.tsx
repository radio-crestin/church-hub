import { Book, Loader2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { usePresentationState } from '~/features/presentation'
import { useQueue, useRemoveFromQueue } from '~/features/queue'
import type { QueueItem } from '~/features/queue/types'
import { useToast } from '~/ui/toast'

interface BibleQueuePanelProps {
  onSelectItem: (item: QueueItem) => void
}

export function BibleQueuePanel({ onSelectItem }: BibleQueuePanelProps) {
  const { t } = useTranslation('bible')
  const { showToast } = useToast()
  const { data: queue, isLoading } = useQueue()
  const { data: presentationState } = usePresentationState()
  const removeFromQueue = useRemoveFromQueue()

  const bibleItems = queue?.filter((item) => item.itemType === 'bible') ?? []

  const handleRemove = async (id: number, event: React.MouseEvent) => {
    event.stopPropagation()
    const success = await removeFromQueue.mutateAsync(id)
    if (success) {
      showToast(t('queue.removed'), 'success')
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700">
          <Book size={18} className="text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            {t('queue.title')}
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Book size={18} className="text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            {t('queue.title')}
          </h3>
          {bibleItems.length > 0 && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({bibleItems.length})
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {bibleItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            {t('queue.empty')}
          </div>
        ) : (
          <div className="space-y-1">
            {bibleItems.map((item) => {
              const isActive = item.id === presentationState?.currentQueueItemId

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors group ${
                    isActive
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 ring-2 ring-indigo-500'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-xs font-medium mb-0.5 ${
                          isActive
                            ? 'text-indigo-700 dark:text-indigo-300'
                            : 'text-indigo-600 dark:text-indigo-400'
                        }`}
                      >
                        {item.bibleReference}
                      </div>
                      <div
                        className={`text-sm line-clamp-2 ${
                          isActive
                            ? 'text-indigo-900 dark:text-indigo-100'
                            : 'text-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {item.bibleText}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleRemove(item.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                      title={t('queue.remove')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
