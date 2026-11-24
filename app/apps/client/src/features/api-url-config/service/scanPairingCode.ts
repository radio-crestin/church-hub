import {
  checkPermissions,
  Format,
  requestPermissions,
  scan,
} from '@tauri-apps/plugin-barcode-scanner'

/**
 * Opens the phone's camera on the pairing QR code the computer shows
 * (Settings > Phones) and returns its link; null when the camera is refused.
 */
export async function scanPairingCode(): Promise<string | null> {
  let permission = await checkPermissions()
  if (permission !== 'granted') permission = await requestPermissions()
  if (permission !== 'granted') return null
  const scanned = await scan({ windowed: false, formats: [Format.QRCode] })
  return scanned.content.trim()
}
