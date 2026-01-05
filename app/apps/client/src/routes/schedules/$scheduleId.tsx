import { createFileRoute, useNavigate } from '@tanstack/react-router'

import {
  ScheduleEditor,
  SchedulePresenter,
} from '~/features/schedules/components'

export const Route = createFileRoute('/schedules/$scheduleId')({
  component: ScheduleEditorPage,
})

function ScheduleEditorPage() {
  const navigate = useNavigate()
  const { scheduleId } = Route.useParams()

  const isNew = scheduleId === 'new'
  const numericId = isNew ? null : parseInt(scheduleId, 10)

  const handleBack = () => {
    navigate({ to: '/schedules' })
  }

  const handleScheduleCreated = (newId: number) => {
    // Navigate to the newly created schedule
    navigate({
      to: '/schedules/$scheduleId',
      params: { scheduleId: String(newId) },
      replace: true,
    })
  }

  // For new schedules, show the editor
  if (isNew) {
    return (
      <ScheduleEditor
        scheduleId={null}
        onBack={handleBack}
        onScheduleCreated={handleScheduleCreated}
      />
    )
  }

  // For existing schedules, show the presenter (which now has all editing capabilities)
  return (
    <SchedulePresenter
      scheduleId={numericId!}
      onBack={handleBack}
      onDeleted={handleBack}
    />
  )
}
