import { createFileRoute } from '@tanstack/react-router'

import { MonitorBadge } from '~/features/presentation'

interface MonitorBadgeSearch {
  name?: string
  size?: string
}

export const Route = createFileRoute('/monitor-badge/$number')({
  validateSearch: (search: Record<string, unknown>): MonitorBadgeSearch => ({
    // Read back as text whatever it looks like: a name such as `1` would
    // otherwise come back a number.
    name: search.name == null ? undefined : String(search.name),
    size: search.size == null ? undefined : String(search.size),
  }),
  component: MonitorBadgePage,
})

function MonitorBadgePage() {
  const { number } = Route.useParams()
  const { name, size } = Route.useSearch()
  return (
    <MonitorBadge
      number={Number.parseInt(number, 10)}
      name={name}
      size={size}
    />
  )
}
