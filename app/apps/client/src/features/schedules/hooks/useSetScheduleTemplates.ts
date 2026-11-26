import { useMutation, useQueryClient } from '@tanstack/react-query'

import { slideTemplatesQueryKey } from '~/features/slide-templates/hooks/useSlideTemplates'
import { setScheduleItemTemplate, setScheduleTemplate } from '../service'

/** The presentation and the templates' "used by" load again after a change. */
function useReload() {
  const queryClient = useQueryClient()
  return (scheduleId: number) => {
    queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] })
    queryClient.invalidateQueries({ queryKey: slideTemplatesQueryKey })
  }
}

/** The template a presentation's slides are drawn with. */
export function useSetScheduleTemplate() {
  const reload = useReload()
  return useMutation({
    mutationFn: ({
      scheduleId,
      templateId,
    }: {
      scheduleId: number
      templateId: number | null
    }) => setScheduleTemplate(scheduleId, templateId),
    onSettled: (_data, _error, { scheduleId }) => reload(scheduleId),
  })
}

/** One item's own template. */
export function useSetScheduleItemTemplate() {
  const reload = useReload()
  return useMutation({
    mutationFn: ({
      scheduleId,
      itemId,
      templateId,
    }: {
      scheduleId: number
      itemId: number
      templateId: number | null
    }) => setScheduleItemTemplate(scheduleId, itemId, templateId),
    onSettled: (_data, _error, { scheduleId }) => reload(scheduleId),
  })
}
