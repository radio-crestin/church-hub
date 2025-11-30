import { useMutation, useQueryClient } from '@tanstack/react-query'

import { PROGRAMS_QUERY_KEY } from './usePrograms'
import { deleteProgram } from '../service/programs'

export function useDeleteProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteProgram(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROGRAMS_QUERY_KEY })
    },
  })
}
