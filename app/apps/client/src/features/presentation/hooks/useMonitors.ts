import { useQuery } from '@tanstack/react-query'

import { listMonitors, type ScreenMonitor } from '../utils/monitors'

/**
 * The monitors attached to this machine.
 *
 * Refetched when the window regains focus so plugging a projector in shows up in
 * the screen settings without restarting the app; empty outside the desktop app,
 * where there is nothing to place a window on.
 */
export function useMonitors() {
  return useQuery<ScreenMonitor[]>({
    queryKey: ['monitors'],
    queryFn: listMonitors,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
}
