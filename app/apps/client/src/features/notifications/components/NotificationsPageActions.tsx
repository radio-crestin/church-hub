import { CheckCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { ConfirmModal } from '~/ui/modal'

interface NotificationsPageActionsProps {
  hasNew: boolean
  isEmpty: boolean
  onMarkAllRead: () => void
  onClearAll: () => void
}

/** The page's header buttons: mark all read, and clear all (once confirmed). */
export function NotificationsPageActions({
  hasNew,
  isEmpty,
  onMarkAllRead,
  onClearAll,
}: NotificationsPageActionsProps) {
  const { t } = useTranslation('notifications')
  const [isConfirming, setIsConfirming] = useState(false)

  return (
    <>
      <Button
        variant="secondary"
        data-testid="notifications-mark-all-read"
        disabled={!hasNew}
        onClick={onMarkAllRead}
        title={t('markAllRead')}
        aria-label={t('markAllRead')}
        className="gap-2"
      >
        <CheckCheck className="h-4 w-4" />
        <span className="hidden sm:inline">{t('markAllRead')}</span>
      </Button>
      <Button
        variant="secondary"
        data-testid="notifications-clear-all"
        disabled={isEmpty}
        onClick={() => setIsConfirming(true)}
        title={t('clearAll')}
        aria-label={t('clearAll')}
        className="gap-2"
      >
        <Trash2 className="h-4 w-4" />
        <span className="hidden sm:inline">{t('clearAll')}</span>
      </Button>
      <ConfirmModal
        isOpen={isConfirming}
        testId="notifications-clear-all-confirm"
        title={t('clearAllTitle')}
        message={t('clearAllMessage')}
        confirmLabel={t('clearAllConfirm')}
        variant="danger"
        onConfirm={() => {
          setIsConfirming(false)
          onClearAll()
        }}
        onCancel={() => setIsConfirming(false)}
      />
    </>
  )
}
