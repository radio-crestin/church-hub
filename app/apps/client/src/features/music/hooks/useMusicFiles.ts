import { useQuery } from '@tanstack/react-query'

import { getFiles } from '../service'
import type { MusicFile } from '../types'

interface UseFilesParams {
  folderId?: number
  recent?: boolean
  search?: string
  enabled?: boolean
}

export function useMusicFiles(params: UseFilesParams = {}) {
  const { folderId, recent, search, enabled = true } = params

  return useQuery<MusicFile[]>({
    queryKey: ['music', 'files', { folderId, recent, search }],
    queryFn: () => getFiles({ folderId, recent, search }),
    enabled,
  })
}
