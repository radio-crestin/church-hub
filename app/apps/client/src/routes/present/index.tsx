import { createFileRoute } from '@tanstack/react-router'

import { ControlRoom } from '~/features/presentation'
import { useLiveProgramNavigation } from '~/features/schedules'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

export const Route = createFileRoute('/present/')({
  component: PresentPage,
})

function PresentPage() {
  const liveProgram = useLiveProgramNavigation()
  return (
    <PagePermissionGuard permission="control_room.view">
      <div className="h-full">
        <ControlRoom liveProgram={liveProgram} />
      </div>
    </PagePermissionGuard>
  )
}
