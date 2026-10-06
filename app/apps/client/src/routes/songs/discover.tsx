import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import {
  SongDiscoveryScreen,
  useSongDiscovery,
} from '~/features/song-discovery'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

interface DiscoverSearch {
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
  const { dismiss } = useSongDiscovery()

  // Opening this screen is the "I've seen it" signal — clear the sidebar badge.
  useEffect(() => {
    dismiss()
  }, [dismiss])

  // Discovering + importing songs is a create operation — gate on songs.create.
  return (
    <PagePermissionGuard permission="songs.create">
      <SongDiscoveryScreen
        sourceId={source}
        onSourceChange={(sourceId) =>
          navigate({
            to: '/songs/discover',
            search: { source: sourceId },
            replace: true,
          })
        }
        onBack={() => navigate({ to: '/songs' })}
      />
    </PagePermissionGuard>
  )
}
