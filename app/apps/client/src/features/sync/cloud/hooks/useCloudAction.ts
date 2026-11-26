import { useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * A cloud sync action: refreshes the sync status (and the owner's church
 * list) once it is done.
 */
export function useCloudAction<TInput, TResult>(
  action: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: action,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['sync'] })
    },
  })
}
