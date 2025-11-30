import { useMutation, useQueryClient } from '@tanstack/react-query'

interface UpsertSongInput {
  id?: number
  title: string
  content: string
}

interface UpsertSongResult {
  success: boolean
  id?: number
  error?: string
}

async function upsertSong(input: UpsertSongInput): Promise<UpsertSongResult> {
  const response = await fetch('http://127.0.0.1:3000/api/songs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    return { success: false, error: 'Failed to save song' }
  }

  const result = await response.json()
  return { success: true, id: result.data?.id }
}

export function useUpsertSong() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: upsertSong,
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['songs'] })
        if (result.id) {
          queryClient.invalidateQueries({ queryKey: ['song', result.id] })
        }
      }
    },
  })
}
