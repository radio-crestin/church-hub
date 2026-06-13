import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import {
  SongDiscoveryScreen,
  useSongDiscovery,
} from '~/features/song-discovery'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

export const Route = createFileRoute('/songs/discover')({
  component: SongDiscoverPage,
})

function SongDiscoverPage() {
  const navigate = useNavigate()
  const { dismiss } = useSongDiscovery()

  // Opening this screen is the "I've seen it" signal — clear the sidebar badge.
  useEffect(() => {
    dismiss()
  }, [dismiss])

  // Discovering + importing songs is a create operation — gate on songs.create.
  return (
    <PagePermissionGuard permission="songs.create">
      <SongDiscoveryScreen onBack={() => navigate({ to: '/songs' })} />
    </PagePermissionGuard>
  )
}
