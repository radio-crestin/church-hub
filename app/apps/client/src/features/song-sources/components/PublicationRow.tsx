import { AlertTriangle, Copy, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { dangerButton, secondaryButton } from './buttonStyles'
import { useSyncPublication, useUnpublish } from '../hooks/usePublications'
import type { Publication } from '../types'

/** One shared category: its link to copy, its sync state and actions. */
export function PublicationRow({ publication }: { publication: Publication }) {
  const { t, i18n } = useTranslation('songDiscovery')
  const { showToast } = useToast()
  const sync = useSyncPublication()
  const stop = useUnpublish()

  const syncedAt = publication.lastSyncedAt
    ? t('songSources.publish.syncedAt', {
        time: new Date(publication.lastSyncedAt * 1000).toLocaleString(
          i18n.language,
        ),
      })
    : t('songSources.publish.notSynced')

  const copyLink = async () => {
    if (!publication.shareUrl) return
    await navigator.clipboard.writeText(publication.shareUrl)
    showToast(t('songSources.publish.copied'), 'success')
  }

  const run = (action: typeof sync, id: number) =>
    action
      .mutateAsync(id)
      .catch((error: Error) =>
        showToast(
          t('songSources.publish.failed', { error: error.message }),
          'error',
        ),
      )

  return (
    <li className="space-y-2 px-3 py-3" data-testid="song-source-publication">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {publication.categoryName}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('songSources.publish.songs', { count: publication.songCount })} ·{' '}
          {syncedAt}
        </p>
      </div>
      {publication.shareUrl && (
        <p className="break-all rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {publication.shareUrl}
        </p>
      )}
      {publication.lastError && (
        <p className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {publication.lastError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copyLink} className={secondaryButton}>
          <Copy className="h-4 w-4" />
          {t('songSources.publish.copyLink')}
        </button>
        <button
          type="button"
          onClick={() => run(sync, publication.id)}
          disabled={sync.isPending}
          className={secondaryButton}
        >
          {sync.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {t('songSources.publish.syncNow')}
        </button>
        <button
          type="button"
          onClick={() => run(stop, publication.id)}
          disabled={stop.isPending}
          className={dangerButton}
        >
          <Trash2 className="h-4 w-4" />
          {t('songSources.publish.stop')}
        </button>
      </div>
    </li>
  )
}
