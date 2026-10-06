import { useNavigate } from '@tanstack/react-router'
import { Loader2, Settings2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { NotificationAction } from '~/features/notifications/components/NotificationAction'
import { NotificationShell } from '~/features/notifications/components/NotificationShell'
import { useSongUpdates } from '../hooks/useSongUpdates'

/**
 * "Checking the song sources", while the server does: only on the
 * notifications page, never as a pop-up. It can be stopped from here.
 */
export function SongCheckingNotification() {
  const { t } = useTranslation('songDiscovery')
  const navigate = useNavigate()
  const { isRunning, cancel } = useSongUpdates()
  if (!isRunning) return null

  return (
    <NotificationShell
      testId="notification-songs-checking"
      icon={Loader2}
      isBusy
      tone="indigo"
      title={t('notification.checkingTitle')}
      description={t('notification.checkingDescription')}
      actions={
        <>
          <NotificationAction
            icon={X}
            onClick={cancel}
            testId="notification-cancel-check"
          >
            {t('notification.cancel')}
          </NotificationAction>
          <NotificationAction
            icon={Settings2}
            onClick={() => void navigate({ to: '/settings/songs' })}
          >
            {t('notification.syncSettings')}
          </NotificationAction>
        </>
      }
    />
  )
}
