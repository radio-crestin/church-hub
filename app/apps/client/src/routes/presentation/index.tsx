import { createFileRoute } from '@tanstack/react-router'

import { ScheduleList } from '~/features/schedules'

export const Route = createFileRoute('/presentation/')({
  component: SchedulesPage,
})

function SchedulesPage() {
  return <ScheduleList className="h-full" />
}
