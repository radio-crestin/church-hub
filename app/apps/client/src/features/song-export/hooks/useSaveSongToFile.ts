import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { useCallback, useState } from 'react'

import type { SongWithSlides } from '~/features/songs/types'
import type { ExportFormat } from '../components/ExportFormatModal'
import {
  generateOpenSongXml,
  generatePptxBase64,
  sanitizeFilename,
} from '../utils'

const LAST_SAVE_PATH_KEY = 'church-hub-last-song-save-path'

export interface SaveSongResult {
  success: boolean
  cancelled?: boolean
  filePath?: string
  error?: string
}

interface FileTypeConfig {
  extension: string
  filterName: string
}

function getFileTypeConfig(format: ExportFormat): FileTypeConfig {
  switch (format) {
    case 'pptx':
      return { extension: 'pptx', filterName: 'PowerPoint' }
    case 'opensong':
    default:
      return { extension: 'opensong', filterName: 'OpenSong' }
  }
}

export function useSaveSongToFile() {
  const [isPending, setIsPending] = useState(false)

  const saveSong = useCallback(
    async (
      song: SongWithSlides,
      format: ExportFormat = 'opensong',
    ): Promise<SaveSongResult> => {
      const lastPath = localStorage.getItem(LAST_SAVE_PATH_KEY)
      const sanitizedTitle = sanitizeFilename(song.title)
      const fileConfig = getFileTypeConfig(format)
      const defaultFilename = `${sanitizedTitle}.${fileConfig.extension}`

      const savePath = await save({
        defaultPath: lastPath
          ? `${lastPath}/${defaultFilename}`
          : defaultFilename,
        filters: [
          { name: fileConfig.filterName, extensions: [fileConfig.extension] },
        ],
      })

      if (!savePath) {
        return { success: false, cancelled: true }
      }

      setIsPending(true)
      try {
        const lastSlashIndex = Math.max(
          savePath.lastIndexOf('/'),
          savePath.lastIndexOf('\\'),
        )
        if (lastSlashIndex > 0) {
          const dirPath = savePath.substring(0, lastSlashIndex)
          localStorage.setItem(LAST_SAVE_PATH_KEY, dirPath)
        }

        if (format === 'pptx') {
          // Generate PPTX and write as binary
          const base64Data = await generatePptxBase64(song)
          const binaryString = atob(base64Data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          await writeFile(savePath, bytes)
        } else {
          // Generate OpenSong XML
          const xmlContent = generateOpenSongXml(song)
          const encoder = new TextEncoder()
          await writeFile(savePath, encoder.encode(xmlContent))
        }

        return { success: true, filePath: savePath }
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
