import { ArrowLeft, Download, Loader2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { formatRelativeTime } from '~/features/sync/utils/formatRelativeTime'

interface DiscoveryHeaderProps {
  onBack?: () => void
  selectedCount: number
  totalCount: number
  onImport: () => void
  isImporting: boolean
  isChecking: boolean
  /** When the sources were last checked for new songs. */
  checkedAt: number | null
  onCheckAgain: () => void
}

/** The page's title line, with "check again" and the big "import all" button. */
export function DiscoveryHeader({
  onBack,
  selectedCount,
  totalCount,
  onImport,
  isImporting,
  isChecking,
  checkedAt,
  onCheckAgain,
}: DiscoveryHeaderProps) {
  const { t, i18n } = useTranslation('songDiscovery')

  return (
    <div className="flex flex-wrap items-center gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          aria-label={t('back')}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('page.title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {isChecking
            ? t('source.checkingAll')
            : checkedAt
              ? t('source.lastChecked', {
                  when: formatRelativeTime(checkedAt, i18n.language),
                })
              : t('page.description')}
        </p>
      </div>
      <button
        type="button"
        onClick={onCheckAgain}
        disabled={isChecking}
        title={t('source.checkAll')}
        className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-200 disabled:opacity-60 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
      >
        <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline">{t('source.checkAll')}</span>
      </button>
      <button
        type="button"
        onClick={onImport}
        disabled={selectedCount === 0 || isImporting}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
      >
        {isImporting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Download className="h-5 w-5" />
        )}
        {selectedCount === totalCount
          ? t('toolbar.importAll', { count: selectedCount })
          : t('toolbar.importSelected', { count: selectedCount })}
      </button>
    </div>
  )
}
