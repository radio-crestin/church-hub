import { useMutation, useQueryClient } from '@tanstack/react-query'

async function deleteSong(id: number): Promise<boolean> {
  const response = await fetch(`http://127.0.0.1:3000/api/songs/${id}`, {
    method: 'DELETE',
  })

  return response.ok
}

export function useDeleteSong() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteSong,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] })
    },
  })
}
