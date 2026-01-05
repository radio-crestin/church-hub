import { useCallback, useState } from 'react'

import type { ChurchProgramData } from '../types'
import { parseChurchProgram } from '../utils/parseChurchProgram'

// Check if we're running in Tauri mode
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export interface LoadScheduleResult {
  success: boolean
  cancelled?: boolean
  data?: ChurchProgramData
  filePath?: string
  error?: string
}

/**
 * Opens a file dialog in browser and returns the file content
 */
function openBrowserFileDialog(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.churchprogram,.json'

    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }

      try {
        const text = await file.text()
        resolve(text)
      } catch {
        resolve(null)
      }
    }

    input.oncancel = () => resolve(null)
    input.click()
  })
}

/**
 * Opens a file dialog in Tauri and returns the file content
 */
async function openTauriFileDialog(): Promise<{
  content: string | null
  path: string | null
}> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const { readTextFile } = await import('@tauri-apps/plugin-fs')

  const filePath = await open({
    filters: [
      { name: 'Church Program', extensions: ['churchprogram', 'json'] },
    ],
    multiple: false,
  })

  if (!filePath || typeof filePath !== 'string') {
    return { content: null, path: null }
  }

  const content = await readTextFile(filePath)
  return { content, path: filePath }
}

/**
 * Hook for loading a schedule from a .churchprogram file
 */
export function useLoadScheduleFromFile() {
  const [isPending, setIsPending] = useState(false)

  const loadSchedule = useCallback(async (): Promise<LoadScheduleResult> => {
    setIsPending(true)

    try {
      let content: string | null = null
      let filePath: string | undefined

      if (isTauri) {
        const result = await openTauriFileDialog()
        content = result.content
        filePath = result.path ?? undefined
      } else {
        content = await openBrowserFileDialog()
      }

      if (content === null) {
        return { success: false, cancelled: true }
      }

      const parseResult = parseChurchProgram(content)

      if (!parseResult.success) {
        return {
          success: false,
          error: parseResult.error ?? 'Failed to parse file',
        }
      }

      return {
        success: true,
        data: parseResult.data,
        filePath,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    } finally {
      setIsPending(false)
    }
  }, [])

  return { loadSchedule, isPending }
}
