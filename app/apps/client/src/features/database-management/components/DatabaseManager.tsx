import {
  AlertTriangle,
  Copy,
  Download,
  FolderOpen,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isTauri } from '~/features/presentation/utils/openDisplayWindow'
import { useToast } from '~/ui/toast'
import { fetcher } from '~/utils/fetcher'
import { useDatabaseExport } from '../hooks/useDatabaseExport'
import {
  type ImportOptions,
  useDatabaseImport,
} from '../hooks/useDatabaseImport'

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
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    songs: true,
    bible: true,
    schedules: true,
    configurations: true,
    copyAndMigrate: false,
  })

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

    const result = await importDatabase(pendingImportPath, importOptions)

    if (result.success) {
      setShowImportConfirm(false)
      setPendingImportPath(null)
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
      setShowImportConfirm(false)
      setPendingImportPath(null)
      showToast(
        t('sections.database.toast.importFailed', { error: result.error }),
        'error',
      )
    }
  }, [pendingImportPath, importDatabase, importOptions, showToast, t])

  const toggleImportOption = useCallback((key: keyof ImportOptions) => {
    setImportOptions((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const hasAnyOptionSelected =
    importOptions.copyAndMigrate ||
    importOptions.songs ||
    importOptions.bible ||
    importOptions.schedules ||
    importOptions.configurations

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
      <h3 className="text-[15px] font-semibold text-fg mb-1">
        {t('sections.database.title')}
      </h3>
      <p className="text-fg-label text-[13px] mb-4">
        {t('sections.database.description')}
      </p>

      <div className="space-y-4">
        {/* Database Path Section */}
        <div className="rounded-xl border border-line p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-medium text-fg-label">
              {t('sections.database.path')}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyPath}
                disabled={isLoading || !databaseInfo?.path}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg disabled:opacity-50"
                title={t('sections.database.copyPath')}
              >
                <Copy strokeWidth={1.5} className="w-4 h-4" />
              </button>
              {isTauri() && (
                <button
                  type="button"
                  onClick={openInFileExplorer}
                  disabled={isLoading || !databaseInfo?.path}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg disabled:opacity-50"
                  title={t('sections.database.openFolder')}
                >
                  <FolderOpen strokeWidth={1.5} className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <code className="block text-xs font-mono bg-field text-fg-body p-2 rounded-lg break-all">
            {isLoading ? '...' : databaseInfo?.path || 'N/A'}
          </code>

          {databaseInfo && (
            <div className="mt-2 text-xs text-fg-hint">
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
          <div className="rounded-xl border border-line p-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0">
                <Download strokeWidth={1.5} className="w-5 h-5 text-fg-label" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[13px] font-medium text-fg">
                  {t('sections.database.export.title')}
                </h4>
                <p className="text-xs text-fg-hint mt-0.5">
                  {t('sections.database.export.description')}
                </p>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting || isLoading || isImporting}
                  className="mt-3 inline-flex h-8 items-center gap-2 px-3 bg-primary text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-[13px] font-medium"
                >
                  <Download strokeWidth={1.5} className="w-4 h-4" />
                  {isExporting
                    ? t('sections.database.export.exporting')
                    : t('sections.database.export.button')}
                </button>
              </div>
            </div>
          </div>

          {/* Import Card */}
          <div className="rounded-xl border border-line p-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0">
                <Upload strokeWidth={1.5} className="w-5 h-5 text-fg-label" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[13px] font-medium text-fg">
                  {t('sections.database.import.title')}
                </h4>
                <p className="text-xs text-fg-hint mt-0.5">
                  {t('sections.database.import.description')}
                </p>
                <button
                  type="button"
                  onClick={handleImportClick}
                  disabled={isImporting || isLoading || isExporting}
                  className="mt-3 inline-flex h-8 items-center gap-2 px-3 bg-field text-fg rounded-lg hover:bg-hover disabled:opacity-50 text-[13px] font-medium"
                >
                  <Upload strokeWidth={1.5} className="w-4 h-4" />
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
            onClick={!isImporting ? handleImportCancel : undefined}
            onKeyDown={(e) =>
              e.key === 'Escape' && !isImporting && handleImportCancel()
            }
          />
          <div className="relative rounded-xl border border-line bg-panel shadow-popover max-w-md w-full mx-4 p-6">
            {/* Loading overlay */}
            {isImporting && (
              <div className="absolute inset-0 bg-panel/80 rounded-xl flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-fg-hint" />
                  <span className="text-[13px] font-medium text-fg-label">
                    {t('sections.database.import.importing')}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-start gap-4">
              <AlertTriangle
                strokeWidth={1.5}
                className="mt-0.5 w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400"
              />
              <div className="flex-1">
                <h3 className="text-base font-semibold text-fg">
                  {t('sections.database.import.confirm.title')}
                </h3>
                <p className="mt-2 text-[13px] text-fg-label">
                  {t('sections.database.import.categories.title')}
                </p>
              </div>
            </div>

            {/* Import options checkboxes */}
            <div className="mt-4 space-y-3">
              {/* Copy and Migrate option - special mode */}
              <label className="flex items-start gap-3 cursor-pointer p-3 bg-field rounded-lg border border-line">
                <input
                  type="checkbox"
                  checked={importOptions.copyAndMigrate}
                  onChange={() => toggleImportOption('copyAndMigrate')}
                  disabled={isImporting}
                  className="mt-0.5 w-4 h-4 rounded border-line text-primary focus:ring-focus disabled:opacity-50"
                />
                <div>
                  <span className="text-[13px] font-medium text-fg">
                    {t('sections.database.import.categories.copyAndMigrate')}
                  </span>
                  <p className="text-xs text-fg-hint">
                    {t(
                      'sections.database.import.categories.copyAndMigrateDescription',
                    )}
                  </p>
                </div>
              </label>

              {/* Divider when not using copyAndMigrate */}
              {!importOptions.copyAndMigrate && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-line" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-panel px-2 text-fg-hint">
                      {t(
                        'sections.database.import.categories.orSelectiveImport',
                      )}
                    </span>
                  </div>
                </div>
              )}

              <label
                className={`flex items-start gap-3 cursor-pointer ${importOptions.copyAndMigrate ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={importOptions.songs}
                  onChange={() => toggleImportOption('songs')}
                  disabled={isImporting || importOptions.copyAndMigrate}
                  className="mt-0.5 w-4 h-4 rounded border-line text-primary focus:ring-focus disabled:opacity-50"
                />
                <div>
                  <span className="text-[13px] font-medium text-fg">
                    {t('sections.database.import.categories.songs')}
                  </span>
                  <p className="text-xs text-fg-hint">
                    {t('sections.database.import.categories.songsDescription')}
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 cursor-pointer ${importOptions.copyAndMigrate ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={importOptions.bible}
                  onChange={() => toggleImportOption('bible')}
                  disabled={isImporting || importOptions.copyAndMigrate}
                  className="mt-0.5 w-4 h-4 rounded border-line text-primary focus:ring-focus disabled:opacity-50"
                />
                <div>
                  <span className="text-[13px] font-medium text-fg">
                    {t('sections.database.import.categories.bible')}
                  </span>
                  <p className="text-xs text-fg-hint">
                    {t('sections.database.import.categories.bibleDescription')}
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 cursor-pointer ${importOptions.copyAndMigrate ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={importOptions.schedules}
                  onChange={() => toggleImportOption('schedules')}
                  disabled={isImporting || importOptions.copyAndMigrate}
                  className="mt-0.5 w-4 h-4 rounded border-line text-primary focus:ring-focus disabled:opacity-50"
                />
                <div>
                  <span className="text-[13px] font-medium text-fg">
                    {t('sections.database.import.categories.schedules')}
                  </span>
                  <p className="text-xs text-fg-hint">
                    {t(
                      'sections.database.import.categories.schedulesDescription',
                    )}
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 cursor-pointer ${importOptions.copyAndMigrate ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={importOptions.configurations}
                  onChange={() => toggleImportOption('configurations')}
                  disabled={isImporting || importOptions.copyAndMigrate}
                  className="mt-0.5 w-4 h-4 rounded border-line text-primary focus:ring-focus disabled:opacity-50"
                />
                <div>
                  <span className="text-[13px] font-medium text-fg">
                    {t('sections.database.import.categories.configurations')}
                  </span>
                  <p className="text-xs text-fg-hint">
                    {t(
                      'sections.database.import.categories.configurationsDescription',
                    )}
                  </p>
                </div>
              </label>
            </div>

            <p className="mt-4 text-[13px] font-medium text-amber-700 dark:text-amber-400">
              {t('sections.database.import.confirm.warning')}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleImportCancel}
                disabled={isImporting}
                className="h-9 px-3.5 text-[13px] font-medium bg-field text-fg hover:bg-hover rounded-lg disabled:opacity-50"
              >
                {t('sections.database.import.confirm.cancel')}
              </button>
              <button
                type="button"
                onClick={handleImportConfirm}
                disabled={isImporting || !hasAnyOptionSelected}
                className="h-9 px-3.5 text-[13px] font-medium bg-amber-600 text-white hover:bg-amber-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {isImporting && <Loader2 className="w-4 h-4 animate-spin" />}
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
          <div className="relative rounded-xl border border-line bg-panel shadow-popover max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-4">
              <RefreshCw
                strokeWidth={1.5}
                className="mt-0.5 w-5 h-5 shrink-0 text-fg-label"
              />
              <div className="flex-1">
                <h3 className="text-base font-semibold text-fg">
                  {t('sections.database.restart.title')}
                </h3>
                <p className="mt-2 text-[13px] text-fg-label">
                  {t('sections.database.restart.message')}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleRestartConfirm}
                disabled={isRestarting}
                className="h-9 px-3.5 text-[13px] font-medium bg-primary text-white hover:bg-indigo-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
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
