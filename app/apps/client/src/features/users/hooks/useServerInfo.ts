import { useQuery } from '@tanstack/react-query'

import { getServerInfo } from '../service/users'

/**
 * Hook to fetch server info (internal IP and ports)
 */
export function useServerInfo() {
  return useQuery({
    queryKey: ['server-info'],
    queryFn: getServerInfo,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  })
}
