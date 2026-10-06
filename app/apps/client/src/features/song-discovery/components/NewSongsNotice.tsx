import { useNavigate } from '@tanstack/react-router'
import { ChevronRight, Music, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useSongDiscovery } from '../context/SongDiscoveryContext'

interface NewSongsNoticeProps {
  isCollapsed: boolean
}

/**
 * The update notification's "new songs" part: every source with songs the
 * library lacks, each opening Song discovery on that source. It stays until
 * dismissed or Song discovery is opened, and comes back when a source changes.
 */
export function NewSongsNotice({ isCollapsed }: NewSongsNoticeProps) {
  const { t } = useTranslation('songDiscovery')
  const navigate = useNavigate()
  const { hasUnacknowledgedNew, newCount, sourceUpdates, dismiss } =
    useSongDiscovery()

  if (!hasUnacknowledgedNew) return null
  const withNew = sourceUpdates.filter((u) => u.count > 0)
  const openSource = (sourceId: string) =>
    navigate({ to: '/songs/discover', search: { source: sourceId } })
  const title = t('notice.title', { count: newCount })

  if (isCollapsed) {
    return (
      <div className="mb-2 flex justify-center">
        <button
          type="button"
          onClick={() => openSource(withNew[0].id)}
          data-testid="sidebar-new-songs"
          className="relative rounded-lg bg-indigo-100 p-2 text-indigo-600 transition-colors hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
          title={title}
        >
          <Music size={16} />
          <span className="absolute -top-1 -right-1 h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
        </button>
      </div>
    )
  }

  return (
    <div
      data-testid="sidebar-new-songs"
      className="mb-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-800 dark:bg-indigo-900/20"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1 text-sm font-medium text-indigo-800 dark:text-indigo-200">
          {title}
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="rounded p-1 text-indigo-600 transition-colors hover:bg-indigo-200 dark:text-indigo-300 dark:hover:bg-indigo-800/50"
          title={t('notice.dismiss')}
          aria-label={t('notice.dismiss')}
        >
          <X size={14} />
        </button>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {withNew.map((update) => (
          <li key={update.id}>
            <button
              type="button"
              onClick={() => openSource(update.id)}
              className="flex w-full items-center gap-2 rounded-md bg-white/70 px-2 py-1.5 text-left text-sm text-gray-800 transition-colors hover:bg-white dark:bg-gray-900/40 dark:text-gray-100 dark:hover:bg-gray-900/70"
            >
              <span className="min-w-0 flex-1 truncate">{update.name}</span>
              <span className="shrink-0 rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold tabular-nums text-white">
                {update.count.toLocaleString()}
              </span>
              <ChevronRight size={14} className="shrink-0 opacity-60" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
