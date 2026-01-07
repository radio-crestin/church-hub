import { createFileRoute } from '@tanstack/react-router'

import { MusicPage } from '../../features/music'

export const Route = createFileRoute('/music/')({
  component: MusicPage,
})
