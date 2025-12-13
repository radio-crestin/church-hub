import { getApiUrl } from '~/config'

export type ConversionErrorCode =
  | 'LIBREOFFICE_NOT_INSTALLED'
  | 'CONVERSION_FAILED'

export interface ConversionError {
  error: string
  errorCode?: ConversionErrorCode
}

export class LibreOfficeNotInstalledError extends Error {
  constructor() {
    super('LibreOffice is not installed')
    this.name = 'LibreOfficeNotInstalledError'
  }
}

/**
 * Converts ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Converts base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Checks if LibreOffice is installed on the server
 */
export async function checkLibreOfficeInstalled(): Promise<boolean> {
  try {
    const response = await fetch(`${getApiUrl()}/api/convert/check-libreoffice`)
    const result = (await response.json()) as { data: { installed: boolean } }
    return result.data.installed
  } catch {
    return false
  }
}

/**
 * Converts a PPT file to PPTX format via server-side LibreOffice conversion
 * @param pptData - Binary PPT file data as ArrayBuffer
 * @returns Converted PPTX data as ArrayBuffer
 * @throws LibreOfficeNotInstalledError if LibreOffice is not installed
 * @throws Error for other conversion failures
 */
export async function convertPptToPptx(
  pptData: ArrayBuffer,
): Promise<ArrayBuffer> {
  const base64Data = arrayBufferToBase64(pptData)

  const response = await fetch(`${getApiUrl()}/api/convert/ppt-to-pptx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64Data }),
  })

  if (!response.ok) {
    const errorData = (await response
      .json()
      .catch(() => ({}))) as ConversionError

    if (errorData.errorCode === 'LIBREOFFICE_NOT_INSTALLED') {
      throw new LibreOfficeNotInstalledError()
    }

    throw new Error(errorData.error || 'Conversion failed')
  }

  const result = (await response.json()) as { data: string }
  return base64ToArrayBuffer(result.data)
}
