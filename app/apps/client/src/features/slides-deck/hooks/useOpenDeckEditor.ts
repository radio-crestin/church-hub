import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'

/** Opens a Slides item's editor, at slide `slide` (0-based) if given. */
export function useOpenDeckEditor() {
  const navigate = useNavigate()
  return useCallback(
    (scheduleId: number, itemId: number, slide?: number) =>
      navigate({
        to: '/schedules/$scheduleId/slides/$itemId',
        params: { scheduleId: String(scheduleId), itemId: String(itemId) },
        search: { slide },
      }),
    [navigate],
  )
}
