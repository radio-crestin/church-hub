import { useQuery } from '@tanstack/react-query'

import { getCuratorStatus } from '../service/songLibrary'

export const curatorStatusQueryKey = ['song-library', 'curator'] as const

/** Who curates on this PC; polled while a sign-in is open in the browser. */
export function useCuratorStatus(polling: boolean) {
  return useQuery({
    queryKey: curatorStatusQueryKey,
    queryFn: getCuratorStatus,
    refetchInterval: polling ? 1500 : false,
  })
}
