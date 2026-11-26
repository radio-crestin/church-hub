import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { dismissResetFeatures, getSecretStoreStatus } from '../service'

const queryKey = ['secret-store', 'status'] as const

export function useSecretStoreStatus() {
  const queryClient = useQueryClient()
  const status = useQuery({ queryKey, queryFn: getSecretStoreStatus })
  const dismiss = useMutation({
    mutationFn: dismissResetFeatures,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })
  return { status: status.data, dismissReset: dismiss.mutate }
}
