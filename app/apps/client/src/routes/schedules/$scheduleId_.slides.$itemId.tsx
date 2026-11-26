import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { DeckEditorPage } from '~/features/slides-deck/editor/components/DeckEditorPage'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

interface DeckEditorSearch {
  /** The slide open first (0-based). */
  slide?: number
}

export const Route = createFileRoute('/schedules/$scheduleId_/slides/$itemId')({
  component: DeckEditorRoute,
  validateSearch: (search: Record<string, unknown>): DeckEditorSearch => ({
    slide: Number.isInteger(Number(search.slide))
      ? Number(search.slide)
      : undefined,
  }),
})

function DeckEditorRoute() {
  const navigate = useNavigate()
  const { scheduleId, itemId } = Route.useParams()
  const { slide } = Route.useSearch()
  return (
    <PagePermissionGuard permission="programs.edit">
      <DeckEditorPage
        scheduleId={Number(scheduleId)}
        itemId={Number(itemId)}
        slideIndex={slide ?? 0}
        onBack={() =>
          navigate({
            to: '/schedules/$scheduleId',
            params: { scheduleId },
          })
        }
      />
    </PagePermissionGuard>
  )
}
