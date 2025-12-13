import { createFileRoute } from '@tanstack/react-router'

import { ControlRoom } from '~/features/presentation'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

export const Route = createFileRoute('/present/')({
  component: PresentPage,
})

function PresentPage() {
  return (
    <PagePermissionGuard permission="control_room.view">
      <div className="h-full">
        <ControlRoom />
      </div>
    </PagePermissionGuard>
  )
}
