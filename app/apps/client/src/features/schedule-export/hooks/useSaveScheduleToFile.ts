import { useCallback, useState } from 'react'

import type { ScheduleWithItems } from '../../schedules/types'
import { sanitizeFilename } from '../../song-export/utils'
import type { ScheduleExportFormat } from '../types'
import {
  generateChurchProgramJson,
  generateScheduleZip,
  serializeChurchProgram,
} from '../utils'

const LAST_SAVE_PATH_KEY = 'church-hub-last-schedule-save-path'

// Check if we're running in Tauri mode
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export interface SaveScheduleResult {
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

function getFileTypeConfig(format: ScheduleExportFormat): FileTypeConfig {
  switch (format) {
    case 'pptx':
      return {
        extension: 'zip',
        filterName: 'ZIP Archive',
        mimeType: 'application/zip',
      }
    case 'churchprogram':
    default:
      return {
        extension: 'churchprogram',
        filterName: 'Church Program',
        mimeType: 'application/json',
      }
  }
}

/**
 * Downloads a file in the browser using a temporary anchor element
 */
function downloadInBrowser(blob: Blob, filename: string): void {
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
): Promise<SaveScheduleResult> {
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

export function useSaveScheduleToFile() {
  const [isPending, setIsPending] = useState(false)

  const saveSchedule = useCallback(
    async (
      schedule: ScheduleWithItems,
      format: ScheduleExportFormat = 'churchprogram',
    ): Promise<SaveScheduleResult> => {
      const sanitizedTitle = sanitizeFilename(schedule.title)
      const fileConfig = getFileTypeConfig(format)
      const defaultFilename = `${sanitizedTitle}.${fileConfig.extension}`

      setIsPending(true)
      try {
        let data: Uint8Array

        if (format === 'pptx') {
          // Generate ZIP with PPTX files and schedule text
          const zipBlob = await generateScheduleZip(schedule)
          const arrayBuffer = await zipBlob.arrayBuffer()
          data = new Uint8Array(arrayBuffer)
        } else {
          // Generate Church Program JSON
          const programData = generateChurchProgramJson(schedule)
          const jsonContent = serializeChurchProgram(programData)
          const encoder = new TextEncoder()
          data = encoder.encode(jsonContent)
        }

        if (isTauri) {
          // Use Tauri's native file dialog
          return await saveWithTauri(data, defaultFilename, fileConfig)
        }

        // Browser fallback - direct download
        const blob = new Blob([data], { type: fileConfig.mimeType })
        downloadInBrowser(blob, defaultFilename)
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

  return { saveSchedule, isPending }
}
