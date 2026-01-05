import { History, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BibleHistoryItem } from './BibleHistoryItem'
import { useBibleHistory, useClearHistory } from '../hooks'
import type { BibleHistoryItem as BibleHistoryItemType } from '../types'

interface BibleHistoryPanelProps {
  onSelectVerse: (item: BibleHistoryItemType) => void
}

export function BibleHistoryPanel({ onSelectVerse }: BibleHistoryPanelProps) {
  const { t } = useTranslation('bible')

  const { data: historyItems = [], isLoading } = useBibleHistory()
  const clearHistoryMutation = useClearHistory()

  const handleClear = () => {
    clearHistoryMutation.mutate()
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('history.title')}
          </span>
          {historyItems.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({historyItems.length})
            </span>
          )}
        </div>
        {historyItems.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            disabled={clearHistoryMutation.isPending}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" />
            {t('history.clear')}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
        {isLoading ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            ...
          </div>
        ) : historyItems.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('history.empty')}
          </div>
        ) : (
          <div className="p-2 flex flex-col gap-1.5">
            {historyItems.map((item, idx) => (
              <BibleHistoryItem
                key={item.id}
                item={item}
                index={idx}
                onClick={() => onSelectVerse(item)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
