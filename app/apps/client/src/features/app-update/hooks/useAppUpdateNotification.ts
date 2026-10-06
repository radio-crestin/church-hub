import { useNavigate } from '@tanstack/react-router'
import { CheckCircle2, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { AppNotification } from '~/features/notifications/types'
import { isTauri } from '~/utils/isTauri'
import { useAppUpdate } from './useAppUpdate'
import { useUpdateDownload } from './useUpdateDownload'

/**
 * "A new version is waiting", for the notifications. It opens the updates
 * page, where the changelog, the download and the install are. A downloaded
 * but not installed update stays until it is installed.
 */
export function useAppUpdateNotification(): AppNotification | null {
  const { t } = useTranslation('sidebar')
  const navigate = useNavigate()
  const { updateInfo, isDismissed, dismissUpdate } = useAppUpdate()
  const { isReady } = useUpdateDownload()

  // A dev instance never polls, so `hasUpdate` is true there only after
  // "Check now" was pressed.
  if (!isTauri() || !updateInfo?.hasUpdate) return null
  if (isDismissed && !isReady) return null

  const { latestVersion } = updateInfo
  return {
    id: `app-update:${latestVersion}:${isReady ? 'ready' : 'available'}`,
    icon: isReady ? CheckCircle2 : Download,
    title: isReady
      ? t('version.readyToInstall', { version: latestVersion })
      : t('version.updateAvailable', { version: latestVersion }),
    description: isReady
      ? t('version.clickToInstall')
      : t('version.clickToOpenUpdates'),
    action: {
      label: isReady ? t('version.install') : t('version.viewUpdate'),
      onClick: () => navigate({ to: '/settings/updates' }),
    },
    dismissible: !isReady,
    onDismiss: dismissUpdate,
  }
}
