import { ScanLine } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { createLogger } from '~/utils/logger'
import { scanPairingCode } from '../service/scanPairingCode'

interface ScanPairingCodeButtonProps {
  /** The link read from the code. */
  onScanned: (url: string) => void
  /** The camera was refused or the scan failed. */
  onError: (message: string) => void
  disabled?: boolean
}

const logger = createLogger('pairing')

/** "Scan the QR code": reads the computer's pairing code with the camera. */
export function ScanPairingCodeButton({
  onScanned,
  onError,
  disabled,
}: ScanPairingCodeButtonProps) {
  const { t } = useTranslation('settings')
  const [isScanning, setIsScanning] = useState(false)

  const handleScan = async () => {
    setIsScanning(true)
    try {
      const url = await scanPairingCode()
      if (url) onScanned(url)
      else onError(t('sections.apiUrl.errors.cameraDenied'))
    } catch (error) {
      logger.error('QR scan failed', error)
      onError(t('sections.apiUrl.errors.scanFailed'))
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <Button
      type="button"
      onClick={handleScan}
      disabled={disabled || isScanning}
      className="w-full"
      data-testid="scan-pairing-code"
    >
      <ScanLine className="mr-2 h-4 w-4" />
      {t('sections.apiUrl.scan')}
    </Button>
  )
}
