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
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {t('sections.factoryReset.title')}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
        {t('sections.factoryReset.description')}
      </p>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <RotateCcw className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              {t('sections.factoryReset.card.title')}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t('sections.factoryReset.card.description')}
            </p>
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={isPending}
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm"
            >
              <RotateCcw className="w-4 h-4" />
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
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('sections.factoryReset.confirm.title')}
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {t('sections.factoryReset.confirm.message')}
                </p>
                <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
                  {t('sections.factoryReset.confirm.warning')}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                {t('sections.factoryReset.confirm.cancel')}
              </button>
              <button
                type="button"
                onClick={handleFactoryReset}
                className="px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded-md"
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
