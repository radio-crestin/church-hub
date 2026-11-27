import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { getFeaturedSources, saveFeaturedSources } from '../service/songLibrary'
import type { FeaturedSource } from '../types'

const featuredQueryKey = ['song-library', 'featured'] as const

/** The sources every app is offered, and saving a curator's edit of them. */
export function useFeaturedSources(enabled: boolean) {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { t } = useTranslation('songLibrary')
  const query = useQuery({
    queryKey: featuredQueryKey,
    queryFn: getFeaturedSources,
    enabled,
  })
  const save = useMutation({
    mutationFn: (sources: FeaturedSource[]) => saveFeaturedSources(sources),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: featuredQueryKey })
      queryClient.invalidateQueries({ queryKey: ['song-sources'] })
      showToast(t('featured.saved'), 'success')
    },
    onError: () => showToast(t('featured.saveFailed'), 'error'),
  })
  return { query, save }
}
