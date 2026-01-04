import { fetcher } from '~/utils/fetcher'

interface ApiResponse<T> {
  data?: T
  error?: string
}

export interface RebuildSearchIndexesOptions {
  songs?: boolean
  schedules?: boolean
  bible?: boolean
}

export interface RebuildSearchIndexesResult {
  success: boolean
  duration?: number
  indexes?: string[]
  error?: string
}

export async function rebuildSearchIndexes(
  options?: RebuildSearchIndexesOptions,
): Promise<RebuildSearchIndexesResult> {
  const response = await fetcher<
    ApiResponse<{ success: boolean; duration: number; indexes: string[] }>
  >('/api/database/rebuild-search-indexes', {
    method: 'POST',
    body: options ? JSON.stringify(options) : undefined,
  })

  if (response.error) {
    return { success: false, error: response.error }
  }

  return {
    success: response.data?.success ?? false,
    duration: response.data?.duration,
    indexes: response.data?.indexes,
  }
}
