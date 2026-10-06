import { useNavigate } from '@tanstack/react-router'
import { Download, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { useSongUpdates } from '../hooks/useSongUpdates'

/**
 * The exact lucide "sparkles" icon (same one in the discovery screen header) as
 * a CSS mask, so the animated gradient behind it shows through the icon shape —
 * giving the icon the same moving gradient as the button border.
 */
const SPARKLES_MASK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z'/%3E%3Cpath d='M20 3v4'/%3E%3Cpath d='M22 5h-4'/%3E%3Cpath d='M4 17v2'/%3E%3Cpath d='M5 18H3'/%3E%3C/svg%3E\") center / contain no-repeat"

/**
 * Header entry point to the discovery screen: the border and the star share
 * one animated gradient. When songs wait for approval, a small button next
 * to it syncs them (with their count). A check running shows only in the
 * notifications.
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
    <div className="mt-1 inline-flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => navigate({ to: '/songs/discover' })}
        title={t('button.discover')}
        className="discover-gradient group relative inline-flex shrink-0 rounded-lg p-[1.5px] shadow-sm transition-transform hover:scale-[1.03]"
      >
        <span className="flex items-center gap-2 whitespace-nowrap rounded-[6.5px] bg-white px-5 py-1.5 text-sm font-medium text-gray-800 dark:bg-gray-900 dark:text-gray-100">
          <span
            aria-hidden="true"
            className="discover-gradient h-4 w-4 shrink-0"
            style={{ WebkitMask: SPARKLES_MASK, mask: SPARKLES_MASK }}
          />
          {t('button.discover')}
        </span>
      </button>
      {pendingCount > 0 && (
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={isSyncing || isRunning}
          data-testid="discover-sync-pending"
          title={t('button.syncPending', { count: pendingCount })}
          aria-label={t('button.syncPending', { count: pendingCount })}
          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-60"
        >
          {isSyncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span className="tabular-nums">{pendingCount}</span>
        </button>
      )}
    </div>
  )
}
