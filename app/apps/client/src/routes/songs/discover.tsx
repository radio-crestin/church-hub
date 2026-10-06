import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { SongDiscoveryScreen } from '~/features/song-discovery'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

interface DiscoverSearch {
  /** Only this source ticked at first (an opened song file, say). */
  source?: string
}

export const Route = createFileRoute('/songs/discover')({
  component: SongDiscoverPage,
  validateSearch: (search: Record<string, unknown>): DiscoverSearch => ({
    source: typeof search.source === 'string' ? search.source : undefined,
  }),
})

function SongDiscoverPage() {
  const navigate = useNavigate()
  const { source } = Route.useSearch()

  // Discovering + importing songs is a create operation — gate on songs.create.
  return (
    <PagePermissionGuard permission="songs.create">
      <SongDiscoveryScreen
        key={source ?? 'all'}
        focusSourceId={source}
        onBack={() => navigate({ to: '/songs' })}
      />
    </PagePermissionGuard>
  )
}
