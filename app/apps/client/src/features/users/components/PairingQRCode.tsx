import { Copy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Combobox, type ComboboxOption } from '~/ui/combobox'
import { useToast } from '~/ui/toast'
import { createLogger } from '~/utils/logger'
import { useQRCode } from '../hooks'
import {
  getExternalInterfaces,
  getUserAuthUrl,
  getUserAuthUrlForIp,
  type NetworkInterface,
} from '../service'

const logger = createLogger('pairing')

/**
 * The QR code another device scans to sign in as the user with `token`: the
 * computer's address on the chosen network, and the same link to copy.
 */
export function PairingQRCode({ token }: { token: string }) {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([])
  const [selected, setSelected] = useState<NetworkInterface | null>(null)

  useEffect(() => {
    getExternalInterfaces()
      .then((found) => {
        setInterfaces(found)
        setSelected((current) => current ?? found[0] ?? null)
      })
      .catch((error) => {
        logger.error('network interfaces unavailable', error)
        setInterfaces([])
      })
  }, [])

  const options: ComboboxOption[] = useMemo(
    () =>
      interfaces.map((iface) => ({
        value: iface.address,
        label: `${iface.name} - ${iface.address}`,
      })),
    [interfaces],
  )

  const authUrl = selected
    ? getUserAuthUrlForIp(token, selected.address)
    : getUserAuthUrl(token)
  const { qrDataUrl, isLoading } = useQRCode(authUrl)

  const copyUrl = async () => {
    await navigator.clipboard.writeText(authUrl)
    showToast(t('sections.users.toast.urlCopied'), 'success')
  }

  return (
    <div className="flex flex-col gap-4">
      {interfaces.length > 0 && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('sections.users.modals.qrCode.networkInterface')}
          </label>
          <Combobox
            options={options}
            value={selected?.address ?? null}
            onChange={(value) =>
              setSelected(interfaces.find((i) => i.address === value) ?? null)
            }
            allowClear={false}
          />
        </div>
      )}

      <div className="flex justify-center rounded-lg bg-white p-4">
        {isLoading || !qrDataUrl ? (
          <div className="flex h-64 w-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
          </div>
        ) : (
          <img
            src={qrDataUrl}
            alt={t('sections.users.modals.qrCode.title')}
            data-testid="pairing-qr"
            data-url={authUrl}
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
            {authUrl}
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
