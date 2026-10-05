import {
  QueryClient,
  QueryClientProvider as ReactQueryClientProvider,
} from '@tanstack/react-query'

/**
 * `networkMode: 'always'`: the API is our own server (this computer or the
 * church network), so the browser's "no internet" status says nothing about
 * it. In the default 'online' mode a Wi-Fi drop paused every request and pages
 * read "nothing loaded" as missing data, e.g. "song not found" (T-096).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'always',
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      gcTime: 1e4 * 60,
      retry: 3,
    },
    mutations: {
      networkMode: 'always',
      retry: 0,
    },
  },
})

export function QueryClientProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ReactQueryClientProvider client={queryClient}>
      {children}
    </ReactQueryClientProvider>
  )
}
