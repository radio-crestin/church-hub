import type { BibleHistoryItem as BibleHistoryItemType } from '../types'

interface BibleHistoryItemProps {
  item: BibleHistoryItemType
  onClick: () => void
}

export function BibleHistoryItem({ item, onClick }: BibleHistoryItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-2.5 py-2 rounded-lg transition-colors hover:bg-hover"
    >
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium mb-0.5 text-fg-label">
          {item.reference}
        </div>
        <div className="text-sm text-fg-body">{item.text}</div>
      </div>
    </button>
  )
}
