import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, Loader2, RefreshCw } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { isTauri } from '~/utils/isTauri'
import { useAppUpdate } from '../hooks/useAppUpdate'
import {
  getUpdateConfig,
  setUpdateDownloadDir,
} from '../services/updateDownloadService'

const CONFIG_KEY = ['app-update', 'config']

/**
 * Settings → Updates: where new versions are downloaded, plus the current
 * update state and a manual check.
 *
 * The folder is stored server-side (`app_settings`), so the download — which
 * the sidecar performs — and this setting agree, and the generic settings
 * routes already gate writes behind `settings.edit`.
 */
export function UpdateSettingsPanel() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const { updateInfo, isLoading, checkNow } = useAppUpdate()

  const configQuery = useQuery({
    queryKey: CONFIG_KEY,
    queryFn: getUpdateConfig,
  })
  const config = configQuery.data

  const setDir = useMutation({
    mutationFn: setUpdateDownloadDir,
    onSuccess: (next) => {
      queryClient.setQueryData(CONFIG_KEY, next)
      showToast(t('sections.updates.folder.saved'), 'success')
    },
    onError: () => showToast(t('sections.updates.folder.failed'), 'error'),
  })

  const handleChooseFolder = useCallback(async () => {
    if (!isTauri()) return
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      directory: true,
      multiple: false,
      title: t('sections.updates.folder.choose'),
      defaultPath: config?.effectiveDownloadDir,
    })
    if (typeof selected === 'string' && selected) {
      await setDir.mutateAsync(selected)
    }
  }, [config?.effectiveDownloadDir, setDir, t])

  return (
    <div className="space-y-4" data-testid="update-settings-panel">
      {/* Download folder */}
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
          {t('sections.updates.folder.title')}
        </h4>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {t('sections.updates.folder.description')}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code
            className="min-w-0 flex-1 truncate rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300"
            title={config?.effectiveDownloadDir}
            data-testid="update-download-dir"
          >
            {config?.effectiveDownloadDir ?? '…'}
          </code>
          {isTauri() && (
            <button
              type="button"
              onClick={handleChooseFolder}
              disabled={setDir.isPending}
              className="inline-flex shrink-0 items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              <FolderOpen className="h-4 w-4" />
              {t('sections.updates.folder.choose')}
            </button>
          )}
          {config?.downloadDir && (
            <button
              type="button"
              onClick={() => setDir.mutate(null)}
              disabled={setDir.isPending}
              className="shrink-0 rounded-md px-2 py-2 text-xs text-gray-500 hover:text-red-600 disabled:opacity-50 dark:text-gray-400 dark:hover:text-red-400"
            >
              {t('sections.updates.folder.reset')}
            </button>
          )}
        </div>
        {!config?.downloadDir && (
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
            {t('sections.updates.folder.usingDefault')}
          </p>
        )}
      </div>

      {/* Current state */}
      <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              {t('sections.updates.status.title')}
            </h4>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {updateInfo?.hasUpdate
                ? t('sections.updates.status.available', {
                    version: updateInfo.latestVersion,
                  })
                : t('sections.updates.status.upToDate', {
                    version: updateInfo?.currentVersion ?? '',
                  })}
            </p>
          </div>
          <button
            type="button"
            onClick={checkNow}
            disabled={isLoading}
            data-testid="update-check-now"
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t('sections.updates.status.check')}
          </button>
        </div>
      </div>
    </div>
  )
}
