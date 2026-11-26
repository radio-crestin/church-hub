import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { PairingQRCode } from './PairingQRCode'

interface UserQRModalProps {
  isOpen: boolean
  userName: string
  token: string
  onClose: () => void
}

export function UserQRModal({
  isOpen,
  userName,
  token,
  onClose,
}: UserQRModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mouseDownTargetRef = useRef<EventTarget | null>(null)
  const { t } = useTranslation('settings')
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    mouseDownTargetRef.current = e.target
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (
      e.target === dialogRef.current &&
      mouseDownTargetRef.current === dialogRef.current
    ) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-xl border border-line shadow-popover backdrop:bg-black/50 bg-panel"
      onClose={onClose}
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="p-6 min-w-[350px] max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-fg">
            {t('sections.users.modals.qrCode.title')}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg"
          >
            <X strokeWidth={1.5} size={16} />
          </button>
        </div>

        <p className="text-sm text-fg-label mb-2">
          {t('sections.users.modals.qrCode.userName')}:{' '}
          <strong>{userName}</strong>
        </p>

        <p className="text-sm text-fg-label mb-4">
          {t('sections.users.modals.qrCode.description')}
        </p>

        {isOpen && <PairingQRCode token={token} />}

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {t('sections.users.modals.qrCode.warning')}
          </p>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="h-9 px-3.5 text-sm font-medium bg-primary hover:bg-indigo-700 text-white rounded-lg
              transition-colors"
          >
            {t('sections.users.modals.qrCode.done')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
