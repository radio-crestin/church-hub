import { useNavigate } from '@tanstack/react-router'
import { Download, Loader2, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { useSongUpdates } from '../hooks/useSongUpdates'

/**
 * Header entry point to the discovery screen, a plain secondary button. When
 * songs wait for approval, a small button next to it syncs them (with their
 * count). A check running shows only in the notifications.
 */
export function DiscoverButton() {
  const { t } = useTranslation('songDiscovery')
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { pendingCount, syncPending, isSyncing, isRunning } = useSongUpdates()

  const syncNow = async () => {
    try {
      await syncPending()
      showToast(t('notification.syncDone', { count: pendingCount }), 'success')
    } catch (error) {
      showToast(t('notification.syncFailed', { error: String(error) }), 'error')
    }
  }

  return (
    <div className="inline-flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => navigate({ to: '/songs/discover' })}
        title={t('button.discover')}
        className="inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-raised px-3 text-sm font-medium text-fg shadow-[inset_0_0_0_1px_var(--color-line)] transition-colors hover:bg-hover"
      >
        <Sparkles
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-fg-label"
          strokeWidth={1.5}
        />
        {t('button.discover')}
      </button>
      {pendingCount > 0 && (
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={isSyncing || isRunning}
          data-testid="discover-sync-pending"
          title={t('button.syncPending', { count: pendingCount })}
          aria-label={t('button.syncPending', { count: pendingCount })}
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
        >
          {isSyncing ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
          ) : (
            <Download className="h-4 w-4" strokeWidth={1.5} />
          )}
          <span className="tabular-nums">{pendingCount}</span>
        </button>
      )}
    </div>
  )
}
