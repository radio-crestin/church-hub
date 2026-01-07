import { useQuery } from '@tanstack/react-query'

import { getFileById, getFiles } from '../service'
import type { MusicFile } from '../types'

interface UseFilesParams {
  folderId?: number
  search?: string
  enabled?: boolean
}

export function useMusicFiles(params: UseFilesParams = {}) {
  const { folderId, search, enabled = true } = params

  return useQuery<MusicFile[]>({
    queryKey: ['music', 'files', { folderId, search }],
    queryFn: () => getFiles({ folderId, search }),
    enabled,
  })
}

export function useMusicFile(id: number | null) {
  return useQuery<MusicFile | null>({
    queryKey: ['music', 'file', id],
    queryFn: () => (id ? getFileById(id) : null),
    enabled: id !== null,
  })
}
