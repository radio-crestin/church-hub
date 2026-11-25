import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Combobox, type ComboboxOption } from '~/ui/combobox'
import { createLogger } from '~/utils/logger'
import { LinkQRCode } from './LinkQRCode'
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

      <LinkQRCode url={authUrl} />
    </div>
  )
}
