import { useCallback, useEffect, useState } from 'react'

import { createLogger } from '~/utils/logger'
import { getLogsContent, type LogsContent } from '../service'

const logger = createLogger('app:logs')

interface UseLogsContent {
  data: LogsContent | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Loads the recent log tails for the viewer and exposes a `refresh` callback
 * (used after a manual refresh or after clearing the logs).
 */
export function useLogsContent(): UseLogsContent {
  const [data, setData] = useState<LogsContent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const content = await getLogsContent()
      setData(content)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`Failed to load logs: ${message}`)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { data, isLoading, error, refresh }
}
