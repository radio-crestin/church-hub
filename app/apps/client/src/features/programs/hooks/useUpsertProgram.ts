import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useProgramQueryKey } from './useProgram'
import { PROGRAMS_QUERY_KEY } from './usePrograms'
import { upsertProgram } from '../service/programs'
import type { UpsertProgramInput } from '../types'

export function useUpsertProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpsertProgramInput) => upsertProgram(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: PROGRAMS_QUERY_KEY })
      if (data.id) {
        queryClient.invalidateQueries({ queryKey: useProgramQueryKey(data.id) })
      }
    },
  })
}
