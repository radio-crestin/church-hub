import { CheckCheck, Loader2, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface DiscoveryToolbarProps {
  totalCount: number
  approvedCount: number
  onApproveAllNew: () => void
  onImport: () => void
  isImporting: boolean
}

/** Summary + bulk actions above the candidate list. */
export function DiscoveryToolbar({
  totalCount,
  approvedCount,
  onApproveAllNew,
  onImport,
  isImporting,
}: DiscoveryToolbarProps) {
  const { t } = useTranslation('songDiscovery')

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-gray-600 dark:text-gray-300">
        {t('toolbar.summary', { total: totalCount, approved: approvedCount })}
      </span>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onApproveAllNew}
          disabled={totalCount === 0 || isImporting}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <CheckCheck className="w-4 h-4" />
          {t('toolbar.approveAllNew')}
        </button>

        <button
          type="button"
          onClick={onImport}
          disabled={approvedCount === 0 || isImporting}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {isImporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {t('toolbar.importApproved', { count: approvedCount })}
        </button>
      </div>
    </div>
  )
}
