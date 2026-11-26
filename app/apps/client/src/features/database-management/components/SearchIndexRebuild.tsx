import { RefreshCw, Search } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { rebuildSearchIndexes } from '../service'

export function SearchIndexRebuild() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const [isPending, setIsPending] = useState(false)

  const handleRebuild = useCallback(async () => {
    setIsPending(true)

    try {
      // Rebuild all search indexes (songs, schedules, bible)
      const result = await rebuildSearchIndexes()

      if (result.success) {
        showToast(
          t('sections.searchIndex.toast.success', {
            duration: result.duration ?? 0,
          }),
          'success',
        )
      } else {
        showToast(
          t('sections.searchIndex.toast.failed', { error: result.error }),
          'error',
        )
      }
    } catch (error) {
      showToast(
        t('sections.searchIndex.toast.failed', {
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
          <Search strokeWidth={1.5} className="w-5 h-5 text-fg-label" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[13px] font-medium text-fg">
            {t('sections.searchIndex.card.title')}
          </h4>
          <p className="text-xs text-fg-hint mt-0.5">
            {t('sections.searchIndex.card.description')}
          </p>
          <button
            type="button"
            onClick={handleRebuild}
            disabled={isPending}
            className="mt-3 inline-flex h-8 items-center gap-2 px-3 bg-primary text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-[13px] font-medium"
          >
            <RefreshCw
              className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`}
            />
            {isPending
              ? t('sections.searchIndex.button.rebuilding')
              : t('sections.searchIndex.button.rebuild')}
          </button>
        </div>
      </div>
    </div>
  )
}
