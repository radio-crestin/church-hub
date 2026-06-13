import { useVirtualizer } from '@tanstack/react-virtual'
import { Check, X } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { VerdictBadge } from './VerdictBadge'
import type { StagingItem } from '../types'

const ESTIMATED_ROW_HEIGHT = 76

interface CandidateListProps {
  items: StagingItem[]
  selectedTempId: string | null
  onSelect: (tempId: string) => void
  onDecide: (tempId: string, decision: 'approve' | 'skip') => void
}

/**
 * Virtualized list of staged candidates (the songs the user lacks). Only the
 * on-screen rows mount, so a multi-thousand-song catalog never floods the DOM.
 * Each row shows the verdict badge + quick approve/skip toggles.
 */
export function CandidateList({
  items,
  selectedTempId,
  onSelect,
  onDecide,
}: CandidateListProps) {
  const { t } = useTranslation('songDiscovery')
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 8,
  })

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6 text-center text-sm text-gray-500 dark:text-gray-400">
        {t('emptyStaging')}
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div
        style={{ height: `${virtualizer.getTotalSize()}px` }}
        className="relative w-full"
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index]
          const isSelected = item.tempId === selectedTempId
          return (
            <div
              key={item.tempId}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <button
                type="button"
                onClick={() => onSelect(item.tempId)}
                className={`w-full text-left px-4 py-3 border-b border-gray-200 dark:border-gray-700 transition-colors ${
                  isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-900/30'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                } ${item.decision === 'skip' ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate font-medium text-gray-900 dark:text-white">
                    {item.draft.title || t('untitled')}
                  </span>
                  <VerdictBadge verdict={item.verdict} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDecide(item.tempId, 'approve')
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                      item.decision === 'approve'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-green-100 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-green-900/40'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                    {t('actions.approve')}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDecide(item.tempId, 'skip')
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                      item.decision === 'skip'
                        ? 'bg-gray-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <X className="w-3 h-3" />
                    {t('actions.skip')}
                  </button>
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
