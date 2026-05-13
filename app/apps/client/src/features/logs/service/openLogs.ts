import { fetcher } from '~/utils/fetcher'

interface OpenLogsResponse {
  data?: { path: string }
  error?: string
}

export async function openLogsFolder(): Promise<{
  success: boolean
  path?: string
  error?: string
}> {
  const response = await fetcher<OpenLogsResponse>('/api/logs/open', {
    method: 'POST',
  })

  if (response.error) {
    return { success: false, error: response.error }
  }

  return { success: true, path: response.data?.path }
}
