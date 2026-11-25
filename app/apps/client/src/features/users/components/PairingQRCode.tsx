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

interface PairingQRCodeProps {
  token: string
  /** Appended to the link for the phone app (remote access: #remote=…). */
  fragment?: string
}

/**
 * The QR code another device scans to sign in as the user with `token`: the
 * computer's address on the chosen network, and the same link to copy.
 */
export function PairingQRCode({ token, fragment = '' }: PairingQRCodeProps) {
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

  const authUrl =
    (selected
      ? getUserAuthUrlForIp(token, selected.address)
      : getUserAuthUrl(token)) + fragment
  const { qrDataUrl, isLoading } = useQRCode(authUrl)

  const copyUrl = async () => {
    await navigator.clipboard.writeText(authUrl)
    showToast(t('sections.users.toast.urlCopied'), 'success')
  }

  return (
    <div className="flex flex-col gap-4">
      {interfaces.length > 0 && (
        <div>
          <label className="mb-2 block text-[13px] font-medium text-fg-body">
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

      <div className="flex justify-center rounded-lg bg-panel p-4">
        {isLoading || !qrDataUrl ? (
          <div className="flex h-64 w-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-fg-label" />
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
        <p className="mb-2 text-[13px] text-fg-label">
          {t('sections.users.modals.qrCode.manualUrl')}
        </p>
        <div className="flex items-center gap-2 rounded-lg bg-field p-2">
          <code className="flex-1 break-all text-xs text-fg-body">
            {authUrl}
          </code>
          <button
            type="button"
            onClick={copyUrl}
            className="rounded p-1 hover:bg-hover"
            title={t('sections.users.actions.copyUrl')}
            aria-label={t('sections.users.actions.copyUrl')}
          >
            <Copy strokeWidth={1.5} size={16} className="text-fg-label" />
          </button>
        </div>
      </div>
    </div>
  )
}
