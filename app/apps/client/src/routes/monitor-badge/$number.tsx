import { createFileRoute } from '@tanstack/react-router'

import { MonitorBadge } from '~/features/presentation'

export const Route = createFileRoute('/monitor-badge/$number')({
  component: MonitorBadgePage,
})

function MonitorBadgePage() {
  const { number } = Route.useParams()
  return <MonitorBadge number={Number.parseInt(number, 10)} />
}
