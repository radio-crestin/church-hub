import { useQuery } from '@tanstack/react-query'

import { getAllScreens } from '../service/screens'

export const screensQueryKey = ['screens']

export function useScreens() {
  return useQuery({
    queryKey: screensQueryKey,
    queryFn: getAllScreens,
  })
}
