import type { BibleHistoryItem as BibleHistoryItemType } from '../types'

interface BibleHistoryItemProps {
  item: BibleHistoryItemType
  index: number
  onClick: () => void
}

export function BibleHistoryItem({
  item,
  index,
  onClick,
}: BibleHistoryItemProps) {
  const previewText =
    item.text.length > 100 ? `${item.text.slice(0, 100)}...` : item.text

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-2 pl-10 rounded-lg border transition-all border-gray-200 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-600 bg-white dark:bg-gray-800 hover:bg-teal-50/50 dark:hover:bg-teal-900/10"
    >
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium mb-0.5 text-gray-500 dark:text-gray-400">
            {item.reference}
          </div>
          <div className="text-sm line-clamp-2 text-gray-700 dark:text-gray-300">
            {previewText}
          </div>
        </div>
      </div>
    </button>
  )
}
