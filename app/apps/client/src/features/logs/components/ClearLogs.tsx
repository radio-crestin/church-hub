import { AlertTriangle, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePermissions } from '~/provider/permissions-provider'
import { useToast } from '~/ui/toast'
import { captureActivity } from '~/utils/activity-logger'
import { clearLogs } from '../service'

interface ClearLogsProps {
  /** Called after a successful clear so the viewer can refetch. */
  onCleared: () => void
}

/**
 * Destructive "clear logs" action, gated by the `logs.clear` permission and
 * guarded behind a confirmation dialog.
 */
export function ClearLogs({ onCleared }: ClearLogsProps) {
  const { t } = useTranslation('settings')
  const { hasPermission } = usePermissions()
  const { showToast } = useToast()
  const [showConfirm, setShowConfirm] = useState(false)
  const [isPending, setIsPending] = useState(false)

  const handleClear = useCallback(async () => {
    setShowConfirm(false)
    setIsPending(true)
    captureActivity('logs.clear', { source: 'settings:logs' })
    try {
      const result = await clearLogs()
      if (result.success) {
        showToast(t('sections.logs.toast.cleared'), 'success')
        onCleared()
      } else {
        showToast(
          t('sections.logs.toast.clearFailed', {
            error: result.error ?? 'unknown',
          }),
          'error',
        )
      }
    } catch (error) {
      showToast(
        t('sections.logs.toast.clearFailed', {
          error: error instanceof Error ? error.message : String(error),
        }),
        'error',
      )
    } finally {
      setIsPending(false)
    }
  }, [onCleared, showToast, t])

  if (!hasPermission('logs.clear')) return null

  return (
    <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
          <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            {t('sections.logs.clear.card.title')}
          </h4>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {t('sections.logs.clear.card.description')}
          </p>
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={isPending}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {isPending
              ? t('sections.logs.clear.button.clearing')
              : t('sections.logs.clear.button.clear')}
          </button>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowConfirm(false)}
            onKeyDown={(e) => e.key === 'Escape' && setShowConfirm(false)}
          />
          <div className="relative mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/30">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('sections.logs.clear.confirm.title')}
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {t('sections.logs.clear.confirm.message')}
                </p>
                <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
                  {t('sections.logs.clear.confirm.warning')}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {t('sections.logs.clear.confirm.cancel')}
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                {t('sections.logs.clear.confirm.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
