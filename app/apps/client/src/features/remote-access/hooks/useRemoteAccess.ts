import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  getRemoteAccess,
  setRemoteAccessEnabled,
} from '../service/remoteAccessApi'

const REMOTE_ACCESS_KEY = ['remote-access']

/** The computer's remote access setting, and turning it on or off. */
export function useRemoteAccess() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: REMOTE_ACCESS_KEY,
    queryFn: getRemoteAccess,
  })
  const toggle = useMutation({
    mutationFn: setRemoteAccessEnabled,
    onSuccess: (data) => queryClient.setQueryData(REMOTE_ACCESS_KEY, data),
  })
  return {
    remoteAccess: query.data,
    setEnabled: toggle.mutate,
    isSaving: toggle.isPending,
  }
}
