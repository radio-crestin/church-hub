import { AlertTriangle, RotateCcw } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { useFactoryReset } from '../hooks/useFactoryReset'

export function FactoryReset() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const [showConfirm, setShowConfirm] = useState(false)
  const { performFactoryReset, isPending } = useFactoryReset()

  const handleFactoryReset = useCallback(async () => {
    setShowConfirm(false)
    const result = await performFactoryReset()

    if (result.success) {
      showToast(t('sections.factoryReset.toast.success'), 'success')
      // Reload the page to reflect the changes
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } else {
      showToast(
        t('sections.factoryReset.toast.failed', { error: result.error }),
        'error',
      )
    }
  }, [performFactoryReset, showToast, t])

  const handleCancel = useCallback(() => {
    setShowConfirm(false)
  }, [])

  return (
    <div>
      <h3 className="text-[15px] font-semibold text-fg mb-1">
        {t('sections.factoryReset.title')}
      </h3>
      <p className="text-fg-label text-[13px] mb-4">
        {t('sections.factoryReset.description')}
      </p>

      <div className="rounded-xl border border-line p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0">
            <RotateCcw strokeWidth={1.5} className="w-5 h-5 text-fg-label" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-[13px] font-medium text-fg">
              {t('sections.factoryReset.card.title')}
            </h4>
            <p className="text-xs text-fg-hint mt-0.5">
              {t('sections.factoryReset.card.description')}
            </p>
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={isPending}
              className="mt-3 inline-flex h-8 items-center gap-2 px-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-[13px] font-medium"
            >
              <RotateCcw strokeWidth={1.5} className="w-4 h-4" />
              {isPending
                ? t('sections.factoryReset.button.resetting')
                : t('sections.factoryReset.button.reset')}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleCancel}
            onKeyDown={(e) => e.key === 'Escape' && handleCancel()}
          />
          <div className="relative rounded-xl border border-line bg-panel shadow-popover max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle
                strokeWidth={1.5}
                className="mt-0.5 w-5 h-5 shrink-0 text-red-600 dark:text-red-400"
              />
              <div className="flex-1">
                <h3 className="text-base font-semibold text-fg">
                  {t('sections.factoryReset.confirm.title')}
                </h3>
                <p className="mt-2 text-[13px] text-fg-label">
                  {t('sections.factoryReset.confirm.message')}
                </p>
                <p className="mt-2 text-[13px] font-medium text-red-600 dark:text-red-400">
                  {t('sections.factoryReset.confirm.warning')}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="h-9 px-3.5 text-[13px] font-medium bg-field text-fg hover:bg-hover rounded-lg"
              >
                {t('sections.factoryReset.confirm.cancel')}
              </button>
              <button
                type="button"
                onClick={handleFactoryReset}
                className="h-9 px-3.5 text-[13px] font-medium bg-red-600 text-white hover:bg-red-700 rounded-lg"
              >
                {t('sections.factoryReset.confirm.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
