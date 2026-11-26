import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { applyConsent } from '~/posthog'
import { fetchConsent, saveConsent } from '../services/analyticsConsent'

const QUERY_KEY = ['analytics', 'consent']

/** The install's "Share anonymous usage data" choice, and a way to change it. */
export function useAnalyticsConsent() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchConsent,
  })

  const { mutateAsync, isPending } = useMutation({
    mutationFn: saveConsent,
    onSuccess: (consent) => {
      queryClient.setQueryData(QUERY_KEY, consent)
      applyConsent(consent)
    },
  })

  return {
    enabled: data?.enabled ?? false,
    isLoading,
    isSaving: isPending,
    setEnabled: mutateAsync,
  }
}
