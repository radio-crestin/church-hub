import { useQuery } from '@tanstack/react-query'

import { getAllDevices } from '../service'

export const DEVICES_QUERY_KEY = ['devices']

export function useDevices() {
  return useQuery({
    queryKey: DEVICES_QUERY_KEY,
    queryFn: getAllDevices,
  })
}
