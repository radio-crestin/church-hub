import { useCallback, useState } from 'react'

import { getApiUrl } from '~/config'
import type { ExportProgress, ScreenExportConfig } from '../service/obs-export'
import { exportScreenHtml } from '../service/obs-export'

interface UseOBSExportOptions {
  screenId: number
  screenName: string
  onSuccess?: (filePath: string) => void
  onError?: (error: string) => void
}

interface UseOBSExportResult {
  exportToFile: () => Promise<void>
  isExporting: boolean
  progress: ExportProgress
  error: string | null
  filePath: string | null
  retry: () => Promise<void>
}

export function useOBSExport(options: UseOBSExportOptions): UseOBSExportResult {
  const { screenId, screenName, onSuccess, onError } = options

  const [progress, setProgress] = useState<ExportProgress>('idle')
  const [error, setError] = useState<string | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)

  const exportToFile = useCallback(async () => {
    setProgress('generating')
    setError(null)
    setFilePath(null)

    const serverUrl = getApiUrl()

    const config: ScreenExportConfig = {
      screenId,
      serverUrl,
      screenName,
    }

    setProgress('saving')

    const result = await exportScreenHtml(config)

    if (result.cancelled) {
      setProgress('idle')
      return
    }

    if (result.success && result.filePath) {
      setProgress('success')
      setFilePath(result.filePath)
      onSuccess?.(result.filePath)
    } else {
      setProgress('error')
      const errorMsg = result.error || 'Unknown error'
      setError(errorMsg)
      onError?.(errorMsg)
    }
  }, [screenId, screenName, onSuccess, onError])

  const retry = useCallback(async () => {
    await exportToFile()
  }, [exportToFile])

  return {
    exportToFile,
    isExporting: progress === 'generating' || progress === 'saving',
    progress,
    error,
    filePath,
    retry,
  }
}
