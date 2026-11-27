import {
  AlertTriangle,
  Copy,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { secondaryButton } from './buttonStyles'
import {
  useStopLibraryShare,
  useSyncLibraryShare,
} from '../hooks/useLibraryShares'
import type { LibraryShare } from '../types'

interface ShareStatusProps {
  share: LibraryShare
  onEdit: () => void
}

/** A share: its link to copy, its state; change it, publish again or stop. */
export function ShareStatus({ share, onEdit }: ShareStatusProps) {
  const { t, i18n } = useTranslation('songDiscovery')
  const { showToast } = useToast()
  const sync = useSyncLibraryShare()
  const stop = useStopLibraryShare()

  const fail = (error: Error) =>
    showToast(t('songSources.share.failed', { error: error.message }), 'error')

  const copyLink = async () => {
    if (!share.manifestUrl) return
    await navigator.clipboard.writeText(share.manifestUrl)
    showToast(t('songSources.publish.copied'), 'success')
  }

  return (
    <div
      className="space-y-2 rounded-lg border border-line bg-panel px-3 py-3"
      data-testid="library-share"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-medium text-fg">
          {share.name}
          <span className="ml-2 text-xs font-normal text-fg-hint">
            {share.listed
              ? t('songSources.share.inCatalog')
              : t('songSources.share.unlisted')}
          </span>
        </p>
        <p className="text-xs text-fg-hint">
          {t('songSources.publish.songs', { count: share.songCount })} ·{' '}
          {share.lastSyncedAt
            ? t('songSources.publish.syncedAt', {
                time: new Date(share.lastSyncedAt).toLocaleString(
                  i18n.language,
                ),
              })
            : t('songSources.publish.notSynced')}
        </p>
      </div>
      {share.manifestUrl && (
        <p
          className="break-all rounded-md bg-field px-2 py-1 font-mono text-xs text-fg-body"
          data-testid="library-share-link"
        >
          {share.manifestUrl}
        </p>
      )}
      {share.lastError && (
        <p className="flex items-start gap-1.5 text-xs text-fg-body">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {share.lastError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyLink}
          disabled={!share.manifestUrl}
          className={secondaryButton}
        >
          <Copy className="h-4 w-4" />
          {t('songSources.publish.copyLink')}
        </button>
        <button type="button" onClick={onEdit} className={secondaryButton}>
          <Pencil className="h-4 w-4" />
          {t('songSources.share.edit')}
        </button>
        <button
          type="button"
          onClick={() => sync.mutateAsync(share.id).catch(fail)}
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
          onClick={() => stop.mutateAsync(share.id).catch(fail)}
          disabled={stop.isPending}
          className={secondaryButton}
        >
          <Trash2 className="h-4 w-4" />
          {t('songSources.share.stop')}
        </button>
      </div>
    </div>
  )
}
