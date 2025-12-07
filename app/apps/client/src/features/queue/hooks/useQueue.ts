import { useQuery } from '@tanstack/react-query'

import { getQueue } from '../service'
import type { QueueItem } from '../types'

export function useQueue() {
  return useQuery<QueueItem[]>({
    queryKey: ['queue'],
    queryFn: getQueue,
  })
}
