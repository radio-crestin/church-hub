import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

interface UseQRCodeResult {
  qrDataUrl: string | null
  error: Error | null
  isLoading: boolean
}

export function useQRCode(url: string | null): UseQRCodeResult {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!url) {
      setQrDataUrl(null)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    QRCode.toDataURL(url, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((dataUrl) => {
        setQrDataUrl(dataUrl)
        setIsLoading(false)
      })
      .catch((err) => {
        setError(err)
        setIsLoading(false)
      })
  }, [url])

  return { qrDataUrl, error, isLoading }
}
