import { createFileRoute } from '@tanstack/react-router'

import { SongKeyPage } from '../../features/song-key'

export const Route = createFileRoute('/song-key/')({
  component: SongKeyPage,
})
