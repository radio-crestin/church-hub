import { useQuery } from '@tanstack/react-query'

import type { MpvStatus } from '../types'

async function fetchMpvStatus(): Promise<MpvStatus> {
  const response = await fetch('/api/music/player/status')
  if (!response.ok) {
    throw new Error('Failed to fetch mpv status')
  }
  const result = await response.json()
  return result.data
}

export function useMpvStatus() {
  return useQuery<MpvStatus>({
    queryKey: ['music', 'mpvStatus'],
    queryFn: fetchMpvStatus,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
