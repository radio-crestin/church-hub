import { generateScreenHtml } from './generateScreenHtml'
import type { ExportResult, ScreenExportConfig } from './types'

const LAST_SAVE_PATH_KEY = 'church-hub-last-obs-export-path'
const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 2000, 4000] // Exponential backoff

// Check if we're running in Tauri mode
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/**
 * Downloads a file in the browser using a temporary anchor element
 */
function downloadInBrowser(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Sanitize filename for file system
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100)
}

/**
 * Saves HTML file using Tauri's native file dialog with retry mechanism
 */
async function saveWithTauri(
  content: string,
  defaultFilename: string,
): Promise<ExportResult> {
  // Dynamic imports for Tauri plugins (only available in Tauri context)
  const { save } = await import('@tauri-apps/plugin-dialog')
  const { writeTextFile } = await import('@tauri-apps/plugin-fs')

  const lastPath = localStorage.getItem(LAST_SAVE_PATH_KEY)

  const savePath = await save({
    defaultPath: lastPath ? `${lastPath}/${defaultFilename}` : defaultFilename,
    filters: [{ name: 'HTML', extensions: ['html'] }],
  })

  if (!savePath) {
    return { success: false, cancelled: true }
  }

  // Save the directory path for next time
  const lastSlashIndex = Math.max(
    savePath.lastIndexOf('/'),
    savePath.lastIndexOf('\\'),
  )
  if (lastSlashIndex > 0) {
    const dirPath = savePath.substring(0, lastSlashIndex)
    localStorage.setItem(LAST_SAVE_PATH_KEY, dirPath)
  }

  // Write file with retry mechanism
  let lastError: Error | null = null
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await writeTextFile(savePath, content)
      return { success: true, filePath: savePath }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAYS[attempt]),
        )
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Failed to save file after multiple attempts',
  }
}

/**
 * Export screen as HTML file for OBS Browser Source
 */
export async function exportScreenHtml(
  config: ScreenExportConfig,
): Promise<ExportResult> {
  const { screenName } = config

  try {
    // Generate HTML content
    const htmlContent = generateScreenHtml(config)
    const sanitizedName = sanitizeFilename(screenName)
    const filename = `${sanitizedName}-screen.html`

    if (isTauri) {
      // Use Tauri's native file dialog
      return await saveWithTauri(htmlContent, filename)
    }

    // Browser fallback - direct download
    downloadInBrowser(htmlContent, filename, 'text/html')
    return { success: true, filePath: filename }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
