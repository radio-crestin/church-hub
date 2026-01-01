import {
  AlertTriangle,
  Copy,
  Download,
  FolderOpen,
  RefreshCw,
  Upload,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isTauri } from '~/features/presentation/utils/openDisplayWindow'
import { useToast } from '~/ui/toast'
import { fetcher } from '~/utils/fetcher'
import { useDatabaseExport } from '../hooks/useDatabaseExport'
import { useDatabaseImport } from '../hooks/useDatabaseImport'

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
  const [showImportConfirm, setShowImportConfirm] = useState(false)
  const [showRestartModal, setShowRestartModal] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)
  const [pendingImportPath, setPendingImportPath] = useState<string | null>(
    null,
  )

  const { exportDatabase, isPending: isExporting } = useDatabaseExport()
  const {
    selectFile,
    importDatabase,
    isPending: isImporting,
  } = useDatabaseImport()

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
    // biome-ignore lint/suspicious/noConsole: Debug logging for file explorer
    console.log('[DatabaseManager] openInFileExplorer called')
    // biome-ignore lint/suspicious/noConsole: Debug logging for file explorer
    console.log('[DatabaseManager] databaseInfo?.path:', databaseInfo?.path)
    // biome-ignore lint/suspicious/noConsole: Debug logging for file explorer
    console.log('[DatabaseManager] isTauri():', isTauri())

    if (!databaseInfo?.path) {
      // biome-ignore lint/suspicious/noConsole: Debug logging for file explorer
      console.log('[DatabaseManager] No database path, returning')
      return
    }

    if (!isTauri()) {
      // biome-ignore lint/suspicious/noConsole: Debug logging for file explorer
      console.log('[DatabaseManager] Not in Tauri, returning')
      return
    }

    try {
      // biome-ignore lint/suspicious/noConsole: Debug logging for file explorer
      console.log('[DatabaseManager] Importing @tauri-apps/plugin-opener')
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
      // biome-ignore lint/suspicious/noConsole: Debug logging for file explorer
      console.log(
        '[DatabaseManager] revealItemInDir imported:',
        revealItemInDir,
      )
      // biome-ignore lint/suspicious/noConsole: Debug logging for file explorer
      console.log(
        '[DatabaseManager] Calling revealItemInDir with path:',
        databaseInfo.path,
      )
      await revealItemInDir(databaseInfo.path)
      // biome-ignore lint/suspicious/noConsole: Debug logging for file explorer
      console.log('[DatabaseManager] revealItemInDir completed successfully')
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Debug logging for file explorer
      console.error('[DatabaseManager] revealItemInDir failed:', error)
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

  const handleImportClick = useCallback(async () => {
    const path = await selectFile()
    if (path) {
      setPendingImportPath(path)
      setShowImportConfirm(true)
    }
  }, [selectFile])

  const handleImportConfirm = useCallback(async () => {
    if (!pendingImportPath) return

    setShowImportConfirm(false)
    const result = await importDatabase(pendingImportPath)
    setPendingImportPath(null)

    if (result.success) {
      if (result.requiresRestart) {
        // Server couldn't reinitialize - show restart modal
        setShowRestartModal(true)
      } else {
        // Database was reinitialized in-process - just reload the page
        showToast(t('sections.database.toast.importSuccess'), 'success')
        // Small delay to show the toast before reloading
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      }
    } else {
      showToast(
        t('sections.database.toast.importFailed', { error: result.error }),
        'error',
      )
    }
  }, [pendingImportPath, importDatabase, showToast, t])

  const handleRestartConfirm = useCallback(async () => {
    setIsRestarting(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('restart_server')
      // Reload the page to reinitialize the app with the new database
      window.location.reload()
    } catch (error) {
      showToast(
        t('sections.database.toast.restartFailed', {
          error: error instanceof Error ? error.message : String(error),
        }),
        'error',
      )
      setIsRestarting(false)
      setShowRestartModal(false)
    }
  }, [showToast, t])

  const handleImportCancel = useCallback(() => {
    setShowImportConfirm(false)
    setPendingImportPath(null)
  }, [])

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
              {isTauri() && (
                <button
                  type="button"
                  onClick={openInFileExplorer}
                  disabled={isLoading || !databaseInfo?.path}
                  className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
                  title={t('sections.database.openFolder')}
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
              )}
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

        {/* Export and Import Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Export Card */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  {t('sections.database.export.title')}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('sections.database.export.description')}
                </p>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting || isLoading || isImporting}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm"
                >
                  <Download className="w-4 h-4" />
                  {isExporting
                    ? t('sections.database.export.exporting')
                    : t('sections.database.export.button')}
                </button>
              </div>
            </div>
          </div>

          {/* Import Card */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Upload className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  {t('sections.database.import.title')}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('sections.database.import.description')}
                </p>
                <button
                  type="button"
                  onClick={handleImportClick}
                  disabled={isImporting || isLoading || isExporting}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 text-sm"
                >
                  <Upload className="w-4 h-4" />
                  {isImporting
                    ? t('sections.database.import.importing')
                    : t('sections.database.import.button')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Import Confirmation Modal */}
      {showImportConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleImportCancel}
            onKeyDown={(e) => e.key === 'Escape' && handleImportCancel()}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('sections.database.import.confirm.title')}
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {t('sections.database.import.confirm.message')}
                </p>
                <p className="mt-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                  {t('sections.database.import.confirm.warning')}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleImportCancel}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                {t('sections.database.import.confirm.cancel')}
              </button>
              <button
                type="button"
                onClick={handleImportConfirm}
                className="px-4 py-2 text-sm bg-amber-600 text-white hover:bg-amber-700 rounded-md"
              >
                {t('sections.database.import.confirm.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restart Required Modal */}
      {showRestartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                <RefreshCw className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('sections.database.restart.title')}
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {t('sections.database.restart.message')}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleRestartConfirm}
                disabled={isRestarting}
                className="px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded-md disabled:opacity-50 flex items-center gap-2"
              >
                {isRestarting && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isRestarting
                  ? t('sections.database.restart.restarting')
                  : t('sections.database.restart.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
