import { CheckSquare, Loader2, Square, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface DiscoveryToolbarProps {
  /** Songs in the source. */
  onlineCount: number
  /** Songs in the source the library lacks. */
  totalCount: number
  selectedCount: number
  onToggleAll: () => void
  onImport: () => void
  isImporting: boolean
}

/** Counts, select all / clear, and the import button above the song list. */
export function DiscoveryToolbar({
  onlineCount,
  totalCount,
  selectedCount,
  onToggleAll,
  onImport,
  isImporting,
}: DiscoveryToolbarProps) {
  const { t } = useTranslation('songDiscovery')
  const allSelected = totalCount > 0 && selectedCount === totalCount

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onToggleAll}
        disabled={totalCount === 0 || isImporting}
        className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
      >
        {allSelected ? (
          <CheckSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        ) : (
          <Square className="h-4 w-4" />
        )}
        {allSelected ? t('toolbar.clearSelection') : t('toolbar.selectAll')}
      </button>

      <span className="flex-1 text-sm text-gray-600 dark:text-gray-300">
        {t('toolbar.summary', {
          total: totalCount.toLocaleString(),
          online: onlineCount.toLocaleString(),
          selected: selectedCount.toLocaleString(),
        })}
      </span>

      <button
        type="button"
        onClick={onImport}
        disabled={selectedCount === 0 || isImporting}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
      >
        {isImporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {t('toolbar.importSelected', { count: selectedCount })}
      </button>
    </div>
  )
}
