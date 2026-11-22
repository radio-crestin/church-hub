import type { QueryClient, QueryKey } from '@tanstack/react-query'

/**
 * Loads the queries again from the server, even while their first load is on
 * its way: React Query answers an invalidation that lands then with that first
 * load, which may have read the data before the change. Cancelling it first
 * makes the new load start now.
 */
export async function reloadQueries(
  queryClient: QueryClient,
  queryKey: QueryKey,
): Promise<void> {
  await queryClient.cancelQueries({ queryKey })
  await queryClient.invalidateQueries({ queryKey })
}
