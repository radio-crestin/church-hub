import { getApiUrl } from '~/config'
import type { ParsedPptx } from './parsePptx'

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
 * Checks if PPT conversion is available on the server.
 * Since conversion is now built-in (pure JS), this always returns true.
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

interface ParsedPptSlide {
  slideNumber: number
  text: string
  htmlContent: string
}

/**
 * Parses a PPT file via server-side pure JS parsing.
 * No LibreOffice or other native dependencies required.
 *
 * @param pptData - Binary PPT file data as ArrayBuffer
 * @param filename - Optional filename for title extraction
 * @returns Parsed presentation data matching ParsedPptx format
 */
export async function parsePptViaServer(
  pptData: ArrayBuffer,
  filename?: string,
): Promise<ParsedPptx> {
  const base64Data = arrayBufferToBase64(pptData)

  const response = await fetch(`${getApiUrl()}/api/convert/ppt-to-pptx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64Data, filename }),
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string
    }
    throw new Error(errorData.error || 'PPT parsing failed')
  }

  const result = (await response.json()) as {
    data: { title: string; slides: ParsedPptSlide[] }
  }

  return {
    title: result.data.title,
    slides: result.data.slides,
  }
}

/**
 * @deprecated Use parsePptViaServer instead. Kept for backward compatibility.
 * Converts a PPT file to PPTX format via server-side conversion.
 * Now actually parses PPT directly and returns the data as-is.
 */
export async function convertPptToPptx(
  _pptData: ArrayBuffer,
): Promise<ArrayBuffer> {
  throw new Error(
    'convertPptToPptx is deprecated. Use parsePptViaServer instead.',
  )
}
