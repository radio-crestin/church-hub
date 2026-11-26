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
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <FolderOpen strokeWidth={1.5} className="w-5 h-5 text-fg-label" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-fg">
            {t('sections.logs.card.title')}
          </h4>
          <p className="text-xs text-fg-hint mt-0.5">
            {t('sections.logs.card.description')}
          </p>
          <button
            type="button"
            onClick={handleOpen}
            disabled={isPending}
            className="mt-3 inline-flex h-8 items-center gap-2 px-3 bg-field text-fg rounded-lg hover:bg-hover disabled:opacity-50 text-sm font-medium"
          >
            <FolderOpen strokeWidth={1.5} className="w-4 h-4" />
            {isPending
              ? t('sections.logs.button.opening')
              : t('sections.logs.button.open')}
          </button>
        </div>
      </div>
    </div>
  )
}
