import { createFileRoute } from '@tanstack/react-router'

import { ProgramsLanding } from '~/features/schedules/components'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

export const Route = createFileRoute('/schedules/')({
  component: SchedulesPage,
})

function SchedulesPage() {
  return (
    <PagePermissionGuard permission="programs.view">
      <ProgramsLanding />
    </PagePermissionGuard>
  )
}
