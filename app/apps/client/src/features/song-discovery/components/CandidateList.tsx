import { useVirtualizer } from '@tanstack/react-virtual'
import { Check } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { VerdictBadge } from './VerdictBadge'
import type { StagingItem } from '../types'

const ESTIMATED_ROW_HEIGHT = 49

interface CandidateListProps {
  items: StagingItem[]
  selectedTempId: string | null
  onSelect: (tempId: string) => void
  /** Picks or unpicks a song for the next import. */
  onToggle: (tempId: string) => void
}

/**
 * Virtualized list of staged candidates (the songs the user lacks). Only the
 * on-screen rows mount, so a multi-thousand-song catalog never floods the DOM.
 * Each row has a checkbox to pick the song for import; the rest of the row
 * opens it for review.
 */
export function CandidateList({
  items,
  selectedTempId,
  onSelect,
  onToggle,
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
          const isOpen = item.tempId === selectedTempId
          return (
            <div
              key={item.tempId}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <div
                className={`flex items-center gap-3 border-b border-gray-200 px-3 transition-colors dark:border-gray-700 ${
                  isOpen
                    ? 'bg-indigo-50 dark:bg-indigo-900/30'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.selected}
                  aria-label={t('actions.select', {
                    title: item.draft.title || t('untitled'),
                  })}
                  onClick={() => onToggle(item.tempId)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                    item.selected
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-gray-300 bg-white hover:border-indigo-400 dark:border-gray-600 dark:bg-gray-800'
                  }`}
                >
                  {item.selected && <Check className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => onSelect(item.tempId)}
                  className="flex min-w-0 flex-1 items-center gap-2 py-3 text-left"
                >
                  <span className="flex-1 truncate font-medium text-gray-900 dark:text-white">
                    {item.draft.title || t('untitled')}
                  </span>
                  <VerdictBadge verdict={item.verdict} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
