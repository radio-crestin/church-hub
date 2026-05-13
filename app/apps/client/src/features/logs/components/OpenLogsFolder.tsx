import { FolderOpen } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { openLogsFolder } from '../service'

export function OpenLogsFolder() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const [isPending, setIsPending] = useState(false)

  const handleOpen = useCallback(async () => {
    setIsPending(true)
    try {
      const result = await openLogsFolder()
      if (result.success) {
        showToast(t('sections.logs.toast.opened'), 'success')
      } else {
        showToast(
          t('sections.logs.toast.failed', {
            error: result.error ?? 'unknown',
          }),
          'error',
        )
      }
    } catch (error) {
      showToast(
        t('sections.logs.toast.failed', {
          error: error instanceof Error ? error.message : String(error),
        }),
        'error',
      )
    } finally {
      setIsPending(false)
    }
  }, [showToast, t])

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
          <FolderOpen className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            {t('sections.logs.card.title')}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('sections.logs.card.description')}
          </p>
          <button
            type="button"
            onClick={handleOpen}
            disabled={isPending}
            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 text-sm"
          >
            <FolderOpen className="w-4 h-4" />
            {isPending
              ? t('sections.logs.button.opening')
              : t('sections.logs.button.open')}
          </button>
        </div>
      </div>
    </div>
  )
}
