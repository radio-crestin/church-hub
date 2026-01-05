import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

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

  // Start in edit mode for new schedules, view mode for existing
  const [mode, setMode] = useState<'view' | 'edit'>(isNew ? 'edit' : 'view')

  const handleBack = () => {
    navigate({ to: '/schedules' })
  }

  const handleScheduleCreated = (newId: number) => {
    // Navigate to the newly created schedule in view mode
    navigate({
      to: '/schedules/$scheduleId',
      params: { scheduleId: String(newId) },
      replace: true, // Replace history entry so back button goes to list
    })
    // Switch to view mode after creation
    setMode('view')
  }

  const handleSwitchToEdit = () => {
    setMode('edit')
  }

  const handleSwitchToView = () => {
    setMode('view')
  }

  // For new schedules or edit mode, show the editor
  if (isNew || mode === 'edit') {
    return (
      <ScheduleEditor
        scheduleId={numericId}
        onBack={numericId ? handleSwitchToView : handleBack}
        onDeleted={handleBack}
        onScheduleCreated={handleScheduleCreated}
      />
    )
  }

  // For existing schedules in view mode, show the presenter
  return (
    <SchedulePresenter
      scheduleId={numericId!}
      onBack={handleBack}
      onEdit={handleSwitchToEdit}
    />
  )
}
