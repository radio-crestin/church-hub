import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { useCallback, useState } from 'react'

import type { ScheduleWithItems } from '../../schedules/types'
import { sanitizeFilename } from '../../song-export/utils'
import { generateChurchProgramJson, serializeChurchProgram } from '../utils'

const LAST_SAVE_PATH_KEY = 'church-hub-last-schedule-save-path'

export interface SaveScheduleResult {
  success: boolean
  cancelled?: boolean
  filePath?: string
  error?: string
}

export function useSaveScheduleToFile() {
  const [isPending, setIsPending] = useState(false)

  const saveSchedule = useCallback(
    async (schedule: ScheduleWithItems): Promise<SaveScheduleResult> => {
      const lastPath = localStorage.getItem(LAST_SAVE_PATH_KEY)
      const sanitizedTitle = sanitizeFilename(schedule.title)
      const defaultFilename = `${sanitizedTitle}.churchprogram`

      const savePath = await save({
        defaultPath: lastPath
          ? `${lastPath}/${defaultFilename}`
          : defaultFilename,
        filters: [{ name: 'Church Program', extensions: ['churchprogram'] }],
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

        const programData = generateChurchProgramJson(schedule)
        const jsonContent = serializeChurchProgram(programData)
        const encoder = new TextEncoder()
        await writeFile(savePath, encoder.encode(jsonContent))

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

  return { saveSchedule, isPending }
}
