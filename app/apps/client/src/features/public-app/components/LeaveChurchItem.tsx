import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmModal } from '~/ui/modal'
import { clearChurchBinding, getChurchBinding } from '../service/churchBinding'

/**
 * The web app's way out of its church (account menu): the device forgets
 * the church, its database too, and opens as a guest. A web app is bound
 * to one user, so it has no other way to sign out.
 */
export function LeaveChurchItem() {
  const { t } = useTranslation('users')
  const [confirming, setConfirming] = useState(false)
  if (!getChurchBinding()) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex h-8 w-full items-center gap-2 rounded-lg px-1.5 text-sm font-medium text-red-600 hover:bg-hover dark:text-red-400"
      >
        <LogOut strokeWidth={1.5} className="h-4 w-4" />
        {t('leaveChurch.button')}
      </button>
      <ConfirmModal
        isOpen={confirming}
        title={t('leaveChurch.title')}
        message={t('leaveChurch.message')}
        confirmLabel={t('leaveChurch.button')}
        cancelLabel={t('leaveChurch.cancel')}
        variant="danger"
        onConfirm={() => {
          clearChurchBinding()
          window.location.replace(import.meta.env.BASE_URL)
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
