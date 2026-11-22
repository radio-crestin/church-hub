import { createFileRoute } from '@tanstack/react-router'

import { MixerSettingsPage } from '../../features/livestream'

export const Route = createFileRoute('/livestream/mixer')({
  component: MixerSettingsPage,
})
