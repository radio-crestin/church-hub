import { useQuery } from '@tanstack/react-query'

import type { SynonymGroup } from '~/service/synonyms'
import { getSynonymsConfig } from '~/service/synonyms'

export function useSynonyms() {
  return useQuery<SynonymGroup[]>({
    queryKey: ['synonyms'],
    queryFn: async () => {
      const config = await getSynonymsConfig()
      return config.groups
    },
  })
}
