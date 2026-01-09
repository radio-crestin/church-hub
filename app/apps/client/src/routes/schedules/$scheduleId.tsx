import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect } from 'react'

import { setSchedulesLastVisited } from '~/features/navigation'
import {
  ScheduleEditor,
  SchedulePresenter,
} from '~/features/schedules/components'

/**
 * Search params for deep-linking to specific schedule items
 */
interface ScheduleSearchParams {
  /** Flat item index to navigate to (0-based) */
  itemIndex?: number
}

export const Route = createFileRoute('/schedules/$scheduleId')({
  component: ScheduleEditorPage,
  validateSearch: (search: Record<string, unknown>): ScheduleSearchParams => ({
    itemIndex:
      typeof search.itemIndex === 'number'
        ? search.itemIndex
        : typeof search.itemIndex === 'string'
          ? parseInt(search.itemIndex, 10) || undefined
          : undefined,
  }),
})

function ScheduleEditorPage() {
  const navigate = useNavigate()
  const { scheduleId } = Route.useParams()
  const { itemIndex: urlItemIndex } = useSearch({
    from: '/schedules/$scheduleId',
  })

  const isNew = scheduleId === 'new'
  const numericId = isNew ? null : parseInt(scheduleId, 10)

  // Save last visited schedule to localStorage
  useEffect(() => {
    if (!isNew && numericId) {
      setSchedulesLastVisited({ scheduleId: numericId })
    }
  }, [isNew, numericId])

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
      urlItemIndex={urlItemIndex}
    />
  )
}
