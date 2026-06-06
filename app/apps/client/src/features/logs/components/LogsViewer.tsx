import { AlertCircle, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { LogsContent } from '../service'

interface LogsViewerProps {
  data: LogsContent | null
  isLoading: boolean
  error: string | null
  onRefresh: () => void
}

function LogBlock({ heading, content }: { heading: string; content: string }) {
  const { t } = useTranslation('settings')
  return (
    <div className="min-w-0">
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {heading}
      </h4>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-relaxed text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
        {content.trim() ? content : t('sections.logs.viewer.empty')}
      </pre>
    </div>
  )
}

/** Read-only viewer for the recent server + Tauri log tails. */
export function LogsViewer({
  data,
  isLoading,
  error,
  onRefresh,
}: LogsViewerProps) {
  const { t } = useTranslation('settings')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-all font-mono text-xs text-gray-500 dark:text-gray-400">
          {data?.logsDir}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading
            ? t('sections.logs.viewer.refreshing')
            : t('sections.logs.viewer.refresh')}
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {t('sections.logs.toast.loadFailed', { error })}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <LogBlock
            heading={t('sections.logs.viewer.serverHeading')}
            content={data?.serverTail ?? ''}
          />
          <LogBlock
            heading={t('sections.logs.viewer.tauriHeading')}
            content={data?.tauriTail ?? ''}
          />
        </div>
      )}
    </div>
  )
}
