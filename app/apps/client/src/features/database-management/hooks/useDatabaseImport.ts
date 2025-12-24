import { open } from '@tauri-apps/plugin-dialog'
import { useCallback, useState } from 'react'

import { fetcher } from '~/utils/fetcher'

interface ImportResult {
  success: boolean
  message: string
  requiresRestart: boolean
  error?: string
}

interface ApiImportResponse {
  data?: ImportResult
  error?: string
}

/**
 * Hook for importing a database from a user-selected file
 */
export function useDatabaseImport() {
  const [isPending, setIsPending] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  const selectFile = useCallback(async (): Promise<string | null> => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }],
    })

    if (typeof selected === 'string') {
      setSelectedPath(selected)
      return selected
    }

    setSelectedPath(null)
    return null
  }, [])

  const importDatabase = useCallback(
    async (
      sourcePath: string,
    ): Promise<{
      success: boolean
      requiresRestart?: boolean
      error?: string
    }> => {
      setIsPending(true)

      try {
        const response = await fetcher<ApiImportResponse>(
          '/api/database/import',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourcePath }),
          },
        )

        if (response.error) {
          return { success: false, error: response.error }
        }

        return {
          success: true,
          requiresRestart: response.data?.requiresRestart,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      } finally {
        setIsPending(false)
        setSelectedPath(null)
      }
    },
    [],
  )

  return { selectFile, importDatabase, isPending, selectedPath }
}
