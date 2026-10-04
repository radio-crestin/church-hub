import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SongHistoryChangeSummary } from './SongHistoryChangeSummary'
import { SongHistoryEntryDetails } from './SongHistoryEntryDetails'
import type { RestoreSide, SongHistoryEntrySummary } from '../types'
import { formatHistoryDate } from '../utils/formatHistoryDate'

interface SongHistoryEntryItemProps {
  entry: SongHistoryEntrySummary
  canRestore: boolean
  onRestore: (entryId: number, side: RestoreSide) => void
}

export function SongHistoryEntryItem({
  entry,
  canRestore,
  onRestore,
}: SongHistoryEntryItemProps) {
  const { t, i18n } = useTranslation('songHistory')
  const [expanded, setExpanded] = useState(false)
  const Chevron = expanded ? ChevronDown : ChevronRight

  return (
    <li
      className="px-4 py-3"
      data-testid="song-history-entry"
      data-kind={entry.kind}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-2 text-left"
      >
        <Chevron
          size={16}
          className="mt-1 shrink-0 text-gray-400"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span
              className="font-medium text-gray-900 dark:text-white"
              data-testid="song-history-author"
            >
              {entry.editedByName}
            </span>
            <span className="text-xs text-indigo-600 dark:text-indigo-300">
              {t(`kind.${entry.kind}`)}
            </span>
          </span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            {formatHistoryDate(entry.createdAt, i18n.language)}
          </span>
          <span className="block text-sm text-gray-600 dark:text-gray-300">
            <SongHistoryChangeSummary entry={entry} />
          </span>
        </span>
      </button>
      {expanded && (
        <SongHistoryEntryDetails
          songId={entry.songId}
          entryId={entry.id}
          canRestore={canRestore}
          onRestore={(side) => onRestore(entry.id, side)}
        />
      )}
    </li>
  )
}
