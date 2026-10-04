import { Loader2, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { stripHtmlTags } from '~/features/songs/utils/stripHtmlTags'
import { useSongHistoryEntry } from '../hooks/useSongHistoryEntry'
import type { RestoreSide, SongHistorySlide } from '../types'
import { findChangedSlides } from '../utils/findChangedSlides'

interface SongHistoryEntryDetailsProps {
  songId: number
  entryId: number
  canRestore: boolean
  onRestore: (side: RestoreSide) => void
}

const BEFORE_CLASS =
  'bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-100 border-red-200 dark:border-red-900/50'
const AFTER_CLASS =
  'bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 border-green-200 dark:border-green-900/50'

function SlideText({
  slide,
  className,
  emptyLabel,
}: {
  slide: SongHistorySlide | null
  className: string
  emptyLabel: string
}) {
  return (
    <div
      className={`min-w-0 whitespace-pre-wrap break-words rounded-lg border p-2 text-sm ${className}`}
    >
      {slide ? (
        stripHtmlTags(slide.content) || (
          <span className="italic opacity-70">{emptyLabel}</span>
        )
      ) : (
        <span className="italic opacity-70">{emptyLabel}</span>
      )}
    </div>
  )
}

/** The expanded part of an entry: what changed, side by side, and the restore buttons. */
export function SongHistoryEntryDetails({
  songId,
  entryId,
  canRestore,
  onRestore,
}: SongHistoryEntryDetailsProps) {
  const { t } = useTranslation('songHistory')
  const { data: entry, isLoading } = useSongHistoryEntry(songId, entryId, true)

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
      </div>
    )
  }
  if (!entry) {
    return (
      <p className="py-3 text-sm text-gray-500 dark:text-gray-400">
        {t('details.unavailable')}
      </p>
    )
  }

  const changedSlides = findChangedSlides(entry.before, entry.after)
  const titleChanged =
    entry.before !== null && entry.before.title !== entry.after.title

  return (
    <div className="space-y-3 pt-3" data-testid="song-history-details">
      {titleChanged && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('details.title')}
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            <div
              className={`min-w-0 break-words rounded-lg border p-2 text-sm ${BEFORE_CLASS}`}
            >
              {entry.before?.title}
            </div>
            <div
              className={`min-w-0 break-words rounded-lg border p-2 text-sm ${AFTER_CLASS}`}
            >
              {entry.after.title}
            </div>
          </div>
        </div>
      )}

      {changedSlides.map((changed) => (
        <div key={changed.index}>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('details.slide', { number: changed.index + 1 })}
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            <SlideText
              slide={changed.before}
              className={BEFORE_CLASS}
              emptyLabel={t('details.noSlide')}
            />
            <SlideText
              slide={changed.after}
              className={AFTER_CLASS}
              emptyLabel={t('details.noSlide')}
            />
          </div>
        </div>
      ))}

      {canRestore && (
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
          {entry.before && (
            <button
              type="button"
              onClick={() => onRestore('before')}
              data-testid="song-history-restore-before"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <RotateCcw size={14} />
              {t('restore.before')}
            </button>
          )}
          <button
            type="button"
            onClick={() => onRestore('after')}
            data-testid="song-history-restore-after"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <RotateCcw size={14} />
            {t('restore.after')}
          </button>
        </div>
      )}
    </div>
  )
}
