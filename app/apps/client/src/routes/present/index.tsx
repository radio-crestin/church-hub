import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { ControlRoom, usePresentationState } from '~/features/presentation'
import {
  ControlRoomQueue,
  useLiveProgramNavigation,
  useQueueSchedule,
  useScheduleFlatNavigation,
} from '~/features/schedules'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

export const Route = createFileRoute('/present/')({
  component: PresentPage,
})

function PresentPage() {
  const { t } = useTranslation('schedules')
  const liveProgram = useLiveProgramNavigation()
  // With nothing on the screens, Next starts the queue; a song or verse put
  // up on its own keeps moving through itself.
  const { data: state } = usePresentationState()
  const { data: queue } = useQueueSchedule()
  const queueNav = useScheduleFlatNavigation({ scheduleId: queue?.id })
  const isScreenFree = !state?.temporaryContent || state.isHidden
  const steps =
    liveProgram ??
    (isScreenFree && queueNav.flatItems.length > 0 ? queueNav : null)
  return (
    <PagePermissionGuard permission="control_room.view">
      <div className="h-full">
        <ControlRoom
          liveProgram={steps}
          playlist={<ControlRoomQueue />}
          playlistTitle={t('queue.title')}
        />
      </div>
    </PagePermissionGuard>
  )
}
