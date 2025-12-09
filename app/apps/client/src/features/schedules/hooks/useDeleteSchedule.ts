import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteSchedule } from '../service'

export function useDeleteSchedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
  })
}
