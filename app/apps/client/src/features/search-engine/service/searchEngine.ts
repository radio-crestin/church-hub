import { fetcher } from '~/utils/fetcher'
import type { ChromaStatus, SearchEngine, SearchEngineInfo } from '../types'

interface ApiResponse<T> {
  data?: T
  error?: string
}

export async function getSearchEngineInfo(): Promise<SearchEngineInfo | null> {
  const response = await fetcher<ApiResponse<SearchEngineInfo>>(
    '/api/search/engine',
    { cache: 'no-store' },
  )
  return response.data ?? null
}

export async function setSearchEngine(
  engine: SearchEngine,
): Promise<SearchEngineInfo | null> {
  const response = await fetcher<ApiResponse<SearchEngineInfo>>(
    '/api/search/engine',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine }),
    },
  )
  return response.data ?? null
}

export async function getChromaStatus(): Promise<ChromaStatus | null> {
  const response = await fetcher<ApiResponse<ChromaStatus>>(
    '/api/search/chroma-status',
    { cache: 'no-store' },
  )
  return response.data ?? null
}

export async function triggerChromaResync(): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ started: boolean }>>(
    '/api/search/chroma-resync',
    { method: 'POST' },
  )
  return response.data?.started ?? false
}
