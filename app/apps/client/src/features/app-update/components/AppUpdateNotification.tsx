import { useNavigate } from '@tanstack/react-router'
import { CheckCircle2, Download, Loader2, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { NotificationAction } from '~/features/notifications/components/NotificationAction'
import { NotificationShell } from '~/features/notifications/components/NotificationShell'
import type { AppNotification } from '~/features/notifications/service/notificationsApi'
import { useUpdateDownload } from '../hooks/useUpdateDownload'

interface AppUpdateNotificationProps {
  notification: AppNotification
  isNew: boolean
  onClose?: () => void
  closeLabel?: string
  onActed?: () => void
  compact?: boolean
}

/**
 * "A new version is out". While it is the version the app can install, the
 * update starts from here: download, then install (which restarts the app).
 */
export function AppUpdateNotification({
  notification,
  isNew,
  onClose,
  closeLabel,
  onActed,
}: AppUpdateNotificationProps) {
  const { t } = useTranslation('sidebar')
  const navigate = useNavigate()
  const { state, progress, startDownload, install } = useUpdateDownload()
  const { version } = notification.data as { version: string }
  const isInstallable = state.version === version
  const isReady = isInstallable && state.phase === 'ready'

  const action = () => {
    if (!isInstallable) {
      return (
        <NotificationAction
          onClick={() => {
            void navigate({ to: '/settings/updates' })
            onActed?.()
          }}
        >
          {t('version.viewUpdate')}
        </NotificationAction>
      )
    }
    switch (state.phase) {
      case 'downloading':
        return (
          <NotificationAction icon={Loader2} onClick={() => {}} disabled>
            {t('version.downloading', { progress: progress ?? 0 })}
          </NotificationAction>
        )
      case 'ready':
        return (
          <NotificationAction
            primary
            icon={RotateCw}
            onClick={() => void install()}
            testId="notification-install-update"
          >
            {t('version.install')}
          </NotificationAction>
        )
      case 'installing':
        return (
          <NotificationAction icon={Loader2} onClick={() => {}} disabled>
            {t('version.installing')}
          </NotificationAction>
        )
      default:
        return (
          <NotificationAction
            primary
            icon={Download}
            onClick={() => void startDownload()}
            testId="notification-download-update"
          >
            {t('version.download')}
          </NotificationAction>
        )
    }
  }

  return (
    <NotificationShell
      testId="notification-app-update"
      icon={isReady ? CheckCircle2 : Download}
      tone="emerald"
      title={
        isReady
          ? t('version.readyToInstall', { version })
          : t('version.updateAvailable', { version })
      }
      description={
        isReady ? t('version.clickToInstall') : t('version.updateDescription')
      }
      createdAt={notification.createdAt}
      isNew={isNew}
      onClose={onClose}
      closeLabel={closeLabel}
      actions={
        <>
          {action()}
          {isInstallable && (
            <NotificationAction
              onClick={() => {
                void navigate({ to: '/settings/updates' })
                onActed?.()
              }}
            >
              {t('version.viewUpdate')}
            </NotificationAction>
          )}
        </>
      }
    />
  )
}
