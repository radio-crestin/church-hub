import { createFileRoute } from '@tanstack/react-router'

import { OBSSettingsPage } from '../../features/livestream'

export const Route = createFileRoute('/livestream/obs')({
  component: OBSSettingsPage,
})
