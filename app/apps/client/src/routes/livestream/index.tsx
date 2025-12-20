import { createFileRoute } from '@tanstack/react-router'

import { LiveStreamPage } from '../../features/livestream'

export const Route = createFileRoute('/livestream/')({
  component: LiveStreamPage,
})
