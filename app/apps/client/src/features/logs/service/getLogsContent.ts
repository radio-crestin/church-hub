import { fetcher } from '~/utils/fetcher'

export interface LogsContent {
  serverTail: string
  tauriTail: string
  logsDir: string
}

interface LogsContentResponse {
  data?: LogsContent
  error?: string
}

/**
 * Fetches the recent server + Tauri log tails for the in-app Logs viewer.
 * Requires the `logs.view` permission (enforced server-side).
 */
export async function getLogsContent(): Promise<LogsContent> {
  const response = await fetcher<LogsContentResponse>('/api/logs/content')
  if (response.error || !response.data) {
    throw new Error(response.error ?? 'Failed to load logs')
  }
  return response.data
}
