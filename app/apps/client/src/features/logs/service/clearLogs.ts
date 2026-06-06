import { fetcher } from '~/utils/fetcher'

interface ClearLogsResponse {
  data?: { cleared: number; logsDir: string }
  error?: string
}

/**
 * Clears (empties) all local log files. Requires the `logs.clear` permission
 * (enforced server-side).
 */
export async function clearLogs(): Promise<{
  success: boolean
  cleared?: number
  error?: string
}> {
  const response = await fetcher<ClearLogsResponse>('/api/logs/clear', {
    method: 'POST',
  })

  if (response.error) {
    return { success: false, error: response.error }
  }

  return { success: true, cleared: response.data?.cleared }
}
