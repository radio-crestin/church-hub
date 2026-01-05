import type { BibleHistoryItem as BibleHistoryItemType } from '../types'

interface BibleHistoryItemProps {
  item: BibleHistoryItemType
  onClick: () => void
}

export function BibleHistoryItem({ item, onClick }: BibleHistoryItemProps) {
  const previewText =
    item.text.length > 100 ? `${item.text.slice(0, 100)}...` : item.text

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-2 rounded-lg border transition-all border-gray-200 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-600 bg-white dark:bg-gray-800 hover:bg-teal-50/50 dark:hover:bg-teal-900/10"
    >
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium mb-0.5 text-gray-500 dark:text-gray-400">
          {item.reference}
        </div>
        <div className="text-sm line-clamp-2 text-gray-700 dark:text-gray-300">
          {previewText}
        </div>
      </div>
    </button>
  )
}
