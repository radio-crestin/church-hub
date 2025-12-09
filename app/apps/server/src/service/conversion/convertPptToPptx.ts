import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import libre from 'libreoffice-convert'

const convertAsync = promisify(libre.convert)
const execAsync = promisify(exec)

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  const prefix = `[conversion] [${level.toUpperCase()}]`
  // biome-ignore lint/suspicious/noConsole: Debug logging utility controlled by env variables
  console.log(`${prefix} ${message}`)
}

export type ConversionErrorCode =
  | 'LIBREOFFICE_NOT_INSTALLED'
  | 'CONVERSION_FAILED'

export interface ConversionResult {
  success: boolean
  data?: Buffer
  error?: string
  errorCode?: ConversionErrorCode
}

/**
 * Checks if LibreOffice is installed on the system
 * Looks for 'soffice' or 'libreoffice' binary in PATH
 */
export async function checkLibreOfficeInstalled(): Promise<boolean> {
  const commands = [
    'which soffice',
    'which libreoffice',
    'soffice --version',
    'libreoffice --version',
  ]

  for (const cmd of commands) {
    try {
      await execAsync(cmd)
      log('debug', `LibreOffice found via: ${cmd}`)
      return true
    } catch {
      // Continue checking other commands
    }
  }

  // On macOS, check common installation paths
  const macPaths = [
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/Applications/OpenOffice.app/Contents/MacOS/soffice',
  ]

  for (const path of macPaths) {
    try {
      await execAsync(`"${path}" --version`)
      log('debug', `LibreOffice found at: ${path}`)
      return true
    } catch {
      // Continue checking
    }
  }

  log('warning', 'LibreOffice not found on system')
  return false
}

/**
 * Converts a PPT file to PPTX format using LibreOffice
 * @param pptData - Binary PPT file data as Buffer
 * @returns ConversionResult with converted PPTX data or error
 */
export async function convertPptToPptx(
  pptData: Buffer,
): Promise<ConversionResult> {
  log('debug', `Converting PPT file (${pptData.length} bytes)`)

  // Check if LibreOffice is installed
  const isInstalled = await checkLibreOfficeInstalled()
  if (!isInstalled) {
    return {
      success: false,
      error:
        'LibreOffice is not installed. Please install LibreOffice to enable PPT to PPTX conversion.',
      errorCode: 'LIBREOFFICE_NOT_INSTALLED',
    }
  }

  try {
    // Convert using libreoffice-convert
    // The '.pptx' extension tells libreoffice-convert the target format
    const pptxBuffer = await convertAsync(pptData, '.pptx', undefined)

    log('info', `Conversion successful (${pptxBuffer.length} bytes)`)
    return {
      success: true,
      data: pptxBuffer,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown conversion error'
    log('error', `Conversion failed: ${message}`)
    return {
      success: false,
      error: `Conversion failed: ${message}`,
      errorCode: 'CONVERSION_FAILED',
    }
  }
}
