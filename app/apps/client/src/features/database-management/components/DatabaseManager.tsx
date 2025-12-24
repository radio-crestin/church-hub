import { invoke } from '@tauri-apps/api/core'
import { Copy, Database, Download, FolderOpen } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { fetcher } from '~/utils/fetcher'
import { useDatabaseExport } from '../hooks/useDatabaseExport'

interface DatabaseInfo {
  path: string
  dataDir: string
  sizeBytes: number
}

interface ApiDatabaseInfoResponse {
  data?: DatabaseInfo
  error?: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

export function DatabaseManager() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const [databaseInfo, setDatabaseInfo] = useState<DatabaseInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { exportDatabase, isPending: isExporting } = useDatabaseExport()

  const fetchDatabaseInfo = useCallback(async () => {
    setIsLoading(true)
    try {
      const response =
        await fetcher<ApiDatabaseInfoResponse>('/api/database/info')
      if (response.data) {
        setDatabaseInfo(response.data)
      }
    } catch {
      // Silently fail - info will show as unavailable
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDatabaseInfo()
  }, [fetchDatabaseInfo])

  const copyPath = useCallback(() => {
    if (databaseInfo?.path) {
      navigator.clipboard.writeText(databaseInfo.path)
      showToast(t('sections.database.toast.pathCopied'), 'success')
    }
  }, [databaseInfo?.path, showToast, t])

  const openInFileExplorer = useCallback(async () => {
    if (!databaseInfo?.path) return

    try {
      // Use invoke workaround for revealItemInDir
      await invoke('plugin:opener|reveal_item_in_dir', {
        path: databaseInfo.path,
      })
    } catch {
      showToast(t('sections.database.toast.openFolderFailed'), 'error')
    }
  }, [databaseInfo?.path, showToast, t])

  const handleExport = useCallback(async () => {
    const result = await exportDatabase()

    if (result.cancelled) {
      return
    }

    if (result.success) {
      showToast(
        t('sections.database.toast.exportSuccess', { path: result.path }),
        'success',
      )
    } else {
      showToast(
        t('sections.database.toast.exportFailed', { error: result.error }),
        'error',
      )
    }
  }, [exportDatabase, showToast, t])

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {t('sections.database.title')}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
        {t('sections.database.description')}
      </p>

      <div className="space-y-4">
        {/* Database Path Section */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('sections.database.path')}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyPath}
                disabled={isLoading || !databaseInfo?.path}
                className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                title={t('sections.database.copyPath')}
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={openInFileExplorer}
                disabled={isLoading || !databaseInfo?.path}
                className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                title={t('sections.database.openFolder')}
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            </div>
          </div>
          <code className="block text-sm font-mono bg-gray-100 dark:bg-gray-900 p-2 rounded break-all">
            {isLoading ? '...' : databaseInfo?.path || 'N/A'}
          </code>

          {databaseInfo && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span>
                {t('sections.database.size')}:{' '}
                {formatBytes(databaseInfo.sizeBytes)}
              </span>
            </div>
          )}
        </div>

        {/* Export Section */}
        <div className="flex items-center gap-4 pt-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
          >
            {isExporting ? (
              <Database className="w-4 h-4 animate-pulse" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isExporting
              ? t('sections.database.export.exporting')
              : t('sections.database.export.button')}
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('sections.database.export.description')}
          </p>
        </div>
      </div>
    </div>
  )
}
