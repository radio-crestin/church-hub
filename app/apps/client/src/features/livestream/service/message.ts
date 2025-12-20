import { fetcher } from '../../../utils/fetcher'

export async function generateBroadcastMessage(
  broadcastUrl?: string,
): Promise<string> {
  const params = broadcastUrl
    ? `?broadcastUrl=${encodeURIComponent(broadcastUrl)}`
    : ''
  const response = await fetcher<{ data: { message: string } }>(
    `/api/livestream/message${params}`,
  )
  return response.data.message
}
