import { useCallback, useState } from 'react'

import type { SongWithSlides } from '~/features/songs/types'
import type { ExportFormat } from '../components/ExportFormatModal'
import {
  generateOpenSongXml,
  generatePptxBase64,
  sanitizeFilename,
} from '../utils'

const LAST_SAVE_PATH_KEY = 'church-hub-last-song-save-path'

// Check if we're running in Tauri mode
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export interface SaveSongResult {
  success: boolean
  cancelled?: boolean
  filePath?: string
  error?: string
}

interface FileTypeConfig {
  extension: string
  filterName: string
  mimeType: string
}

function getFileTypeConfig(format: ExportFormat): FileTypeConfig {
  switch (format) {
    case 'pptx':
      return {
        extension: 'pptx',
        filterName: 'PowerPoint',
        mimeType:
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      }
    case 'opensong':
    default:
      return {
        extension: 'opensong',
        filterName: 'OpenSong',
        mimeType: 'application/xml',
      }
  }
}

/**
 * Downloads a file in the browser using a temporary anchor element
 */
function downloadInBrowser(
  data: Blob | string,
  filename: string,
  mimeType: string,
): void {
  const blob =
    data instanceof Blob ? data : new Blob([data], { type: mimeType })
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
 * Saves a file using Tauri's native file dialog and filesystem APIs
 */
async function saveWithTauri(
  data: Uint8Array,
  defaultFilename: string,
  fileConfig: FileTypeConfig,
): Promise<SaveSongResult> {
  // Dynamic imports for Tauri plugins (only available in Tauri context)
  const { save } = await import('@tauri-apps/plugin-dialog')
  const { writeFile } = await import('@tauri-apps/plugin-fs')

  const lastPath = localStorage.getItem(LAST_SAVE_PATH_KEY)

  const savePath = await save({
    defaultPath: lastPath ? `${lastPath}/${defaultFilename}` : defaultFilename,
    filters: [
      { name: fileConfig.filterName, extensions: [fileConfig.extension] },
    ],
  })

  if (!savePath) {
    return { success: false, cancelled: true }
  }

  const lastSlashIndex = Math.max(
    savePath.lastIndexOf('/'),
    savePath.lastIndexOf('\\'),
  )
  if (lastSlashIndex > 0) {
    const dirPath = savePath.substring(0, lastSlashIndex)
    localStorage.setItem(LAST_SAVE_PATH_KEY, dirPath)
  }

  await writeFile(savePath, data)

  return { success: true, filePath: savePath }
}

export function useSaveSongToFile() {
  const [isPending, setIsPending] = useState(false)

  const saveSong = useCallback(
    async (
      song: SongWithSlides,
      format: ExportFormat = 'opensong',
    ): Promise<SaveSongResult> => {
      const sanitizedTitle = sanitizeFilename(song.title)
      const fileConfig = getFileTypeConfig(format)
      const defaultFilename = `${sanitizedTitle}.${fileConfig.extension}`

      setIsPending(true)
      try {
        let data: Uint8Array

        if (format === 'pptx') {
          // Generate PPTX as binary
          const base64Data = await generatePptxBase64(song)
          const binaryString = atob(base64Data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          data = bytes
        } else {
          // Generate OpenSong XML
          const xmlContent = generateOpenSongXml(song)
          const encoder = new TextEncoder()
          data = encoder.encode(xmlContent)
        }

        if (isTauri) {
          // Use Tauri's native file dialog
          return await saveWithTauri(data, defaultFilename, fileConfig)
        }
        // Browser fallback - direct download
        const blob = new Blob([data], { type: fileConfig.mimeType })
        downloadInBrowser(blob, defaultFilename, fileConfig.mimeType)
        return { success: true, filePath: defaultFilename }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      } finally {
        setIsPending(false)
      }
    },
    [],
  )

  return { saveSong, isPending }
}
