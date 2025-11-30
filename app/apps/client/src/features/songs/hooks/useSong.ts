import { useQuery } from '@tanstack/react-query'

interface Song {
  id: number
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

async function fetchSong(id: number): Promise<Song | null> {
  const response = await fetch(`http://127.0.0.1:3000/api/songs/${id}`)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch song')
  }
  const result = await response.json()
  return result.data
}

export function useSong(id: number | null) {
  return useQuery({
    queryKey: ['song', id],
    queryFn: () => fetchSong(id!),
    enabled: id !== null,
  })
}
