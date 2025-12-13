import { Copy, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '../../../ui/toast'
import { useQRCode, useServerInfo } from '../hooks'
import { getUserAuthUrl } from '../service'

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
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const { data: serverInfo } = useServerInfo()

  const authUrl = isOpen ? getUserAuthUrl(token, serverInfo ?? null) : null
  const { qrDataUrl, isLoading } = useQRCode(authUrl)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

  const copyUrl = async () => {
    if (authUrl) {
      await navigator.clipboard.writeText(authUrl)
      showToast(t('sections.users.toast.urlCopied'), 'success')
    }
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-lg shadow-xl backdrop:bg-black/50 bg-white dark:bg-gray-800"
      onClose={onClose}
      onClick={handleBackdropClick}
    >
      <div className="p-6 min-w-[350px] max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('sections.users.modals.qrCode.title')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {t('sections.users.modals.qrCode.userName')}:{' '}
          <strong>{userName}</strong>
        </p>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t('sections.users.modals.qrCode.description')}
        </p>

        <div className="flex justify-center mb-4 bg-white p-4 rounded-lg">
          {isLoading ? (
            <div className="w-64 h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="rounded-lg" />
          ) : null}
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {t('sections.users.modals.qrCode.warning')}
          </p>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {t('sections.users.modals.qrCode.manualUrl')}
        </p>

        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-2">
          <code className="text-xs flex-1 break-all text-gray-800 dark:text-gray-200">
            {authUrl}
          </code>
          <button
            onClick={copyUrl}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            title={t('sections.users.actions.copyUrl')}
          >
            <Copy size={16} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg
              transition-colors"
          >
            {t('sections.users.modals.qrCode.done')}
          </button>
        </div>
      </div>
    </dialog>
  )
}
