import { useCallback, useState } from 'react'

import type { ChurchProgramData } from '../types'
import { parseChurchProgram } from '../utils/parseChurchProgram'
import { parseMarkdownProgram } from '../utils/parseMarkdownProgram'

// Check if we're running in Tauri mode
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export interface LoadScheduleResult {
  success: boolean
  cancelled?: boolean
  data?: ChurchProgramData
  filePath?: string
  error?: string
}

/** A saved presentation, or a Markdown list (such as a Marcaje export). */
const EXTENSIONS = ['churchprogram', 'json', 'md', 'markdown']

interface OpenedFile {
  content: string
  name: string
}

/**
 * Opens a file dialog in browser and returns the file
 */
function openBrowserFileDialog(): Promise<OpenedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = EXTENSIONS.map((extension) => `.${extension}`).join(',')

    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }

      try {
        resolve({ content: await file.text(), name: file.name })
      } catch {
        resolve(null)
      }
    }

    input.oncancel = () => resolve(null)
    input.click()
  })
}

/**
 * Opens a file dialog in Tauri and returns the file and its path
 */
async function openTauriFileDialog(): Promise<
  (OpenedFile & { path: string }) | null
> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const { readTextFile } = await import('@tauri-apps/plugin-fs')

  const filePath = await open({
    filters: [{ name: 'Church Program, Markdown', extensions: EXTENSIONS }],
    multiple: false,
  })

  if (!filePath || typeof filePath !== 'string') return null

  const content = await readTextFile(filePath)
  const name = filePath.split(/[\\/]/).pop() ?? filePath
  return { content, name, path: filePath }
}

/** A Markdown file becomes a presentation of its songs, passages and notes. */
function parseFile(file: OpenedFile) {
  const markdown = file.name.match(/^(.*)\.(?:md|markdown)$/i)
  if (markdown) {
    return {
      success: true,
      data: parseMarkdownProgram(file.content, markdown[1]),
    }
  }
  return parseChurchProgram(file.content)
}

/**
 * Hook for loading a schedule from a .churchprogram file, or from a Markdown
 * list of songs, Bible passages and notes
 */
export function useLoadScheduleFromFile() {
  const [isPending, setIsPending] = useState(false)

  const loadSchedule = useCallback(async (): Promise<LoadScheduleResult> => {
    setIsPending(true)

    try {
      let file: OpenedFile | null
      let filePath: string | undefined

      if (isTauri) {
        const result = await openTauriFileDialog()
        file = result
        filePath = result?.path
      } else {
        file = await openBrowserFileDialog()
      }

      if (file === null) {
        return { success: false, cancelled: true }
      }

      const parseResult = parseFile(file)

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
