import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { SynonymGroup } from '~/service/synonyms'
import { addSynonymGroup, updateSynonymGroup } from '~/service/synonyms'

interface UpsertSynonymInput {
  id?: string
  primary: string
  synonyms: string[]
}

export function useUpsertSynonym() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpsertSynonymInput) => {
      if (input.id) {
        const group: SynonymGroup = {
          id: input.id,
          primary: input.primary,
          synonyms: input.synonyms,
        }
        return await updateSynonymGroup(group)
      }
      return await addSynonymGroup({
        primary: input.primary,
        synonyms: input.synonyms,
      })
    },
    onSuccess: (success) => {
      if (success) {
        queryClient.invalidateQueries({ queryKey: ['synonyms'] })
      }
    },
  })
}
