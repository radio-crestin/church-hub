import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { ControlRoom } from '~/features/presentation'
import {
  PresentationPlaylist,
  useLiveProgramNavigation,
} from '~/features/schedules'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

export const Route = createFileRoute('/present/')({
  component: PresentPage,
})

function PresentPage() {
  const { t } = useTranslation('schedules')
  const liveProgram = useLiveProgramNavigation()
  return (
    <PagePermissionGuard permission="control_room.view">
      <div className="h-full">
        <ControlRoom
          liveProgram={liveProgram}
          playlist={<PresentationPlaylist />}
          playlistTitle={t('playlist.title')}
        />
      </div>
    </PagePermissionGuard>
  )
}
