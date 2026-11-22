import { createFileRoute } from '@tanstack/react-router'

import { YouTubeSettingsPage } from '../../features/livestream'

export const Route = createFileRoute('/livestream/youtube')({
  component: YouTubeSettingsPage,
})
