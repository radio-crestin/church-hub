import { Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { useQRCode } from '../hooks'

interface LinkQRCodeProps {
  url: string
  /** The QR image's test id; it also carries the link as `data-url`. */
  testId?: string
}

/** A link as a QR code to scan, and the same link to copy. */
export function LinkQRCode({ url, testId = 'pairing-qr' }: LinkQRCodeProps) {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const { qrDataUrl, isLoading } = useQRCode(url)

  const copyUrl = async () => {
    await navigator.clipboard.writeText(url)
    showToast(t('sections.users.toast.urlCopied'), 'success')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center rounded-lg bg-white p-4">
        {isLoading || !qrDataUrl ? (
          <div className="flex h-64 w-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
          </div>
        ) : (
          <img
            src={qrDataUrl}
            alt={t('sections.users.modals.qrCode.title')}
            data-testid={testId}
            data-url={url}
            className="rounded-lg"
          />
        )}
      </div>

      <div>
        <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
          {t('sections.users.modals.qrCode.manualUrl')}
        </p>
        <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-2 dark:bg-gray-700">
          <code className="flex-1 break-all text-xs text-gray-800 dark:text-gray-200">
            {url}
          </code>
          <button
            type="button"
            onClick={copyUrl}
            className="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-600"
            title={t('sections.users.actions.copyUrl')}
            aria-label={t('sections.users.actions.copyUrl')}
          >
            <Copy size={16} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  )
}
