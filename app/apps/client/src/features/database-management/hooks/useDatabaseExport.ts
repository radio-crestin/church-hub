import { save } from '@tauri-apps/plugin-dialog'
import { useCallback, useState } from 'react'

import { fetcher } from '~/utils/fetcher'

interface ExportResult {
  success: boolean
  exportedPath: string
  error?: string
}

interface ApiExportResponse {
  data?: ExportResult
  error?: string
}

/**
 * Hook for exporting the database to a user-selected location
 */
export function useDatabaseExport() {
  const [isPending, setIsPending] = useState(false)

  const exportDatabase = useCallback(async (): Promise<{
    success: boolean
    path?: string
    cancelled?: boolean
    error?: string
  }> => {
    // Generate default filename with date and time
    const now = new Date()
    const date = now.toISOString().split('T')[0]
    const time = now.toTimeString().split(' ')[0].replace(/:/g, '-')
    const defaultFilename = `church-hub-backup-${date}_${time}.db`

    // Show save dialog first so user can choose location
    const savePath = await save({
      defaultPath: defaultFilename,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    })

    if (!savePath) {
      // User cancelled
      return { success: false, cancelled: true }
    }

    setIsPending(true)

    try {
      const response = await fetcher<ApiExportResponse>(
        '/api/database/export',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destinationPath: savePath }),
        },
      )

      if (response.error) {
        return { success: false, error: response.error }
      }

      return {
        success: true,
        path: response.data?.exportedPath || savePath,
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

  return { exportDatabase, isPending }
}
