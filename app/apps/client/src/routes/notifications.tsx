import { createFileRoute } from '@tanstack/react-router'

import { NotificationsPage } from '~/features/notifications/components/NotificationsPage'

export const Route = createFileRoute('/notifications')({
  component: NotificationsPage,
})
