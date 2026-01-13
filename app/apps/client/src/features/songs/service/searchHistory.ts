import { fetcher } from '~/utils/fetcher'
import type { AISearchResult } from '../types'

interface ApiResponse<T> {
  data?: T
  error?: string
}

export interface SearchHistoryItem {
  id: number
  query: string
  urlPath: string
  searchType: 'regular' | 'ai'
  categoryIds: number[] | null
  aiResults: AISearchResult[] | null
  resultCount: number | null
  createdAt: number
}

export interface SaveSearchInput {
  query: string
  urlPath: string
  searchType: 'regular' | 'ai'
  categoryIds?: number[] | null
  aiResults?: AISearchResult[] | null
  resultCount?: number | null
}

export async function getSearchHistory(
  urlPath: string,
): Promise<SearchHistoryItem | null> {
  const params = new URLSearchParams()
  params.set('urlPath', urlPath)
  const response = await fetcher<ApiResponse<SearchHistoryItem | null>>(
    `/api/search-history?${params.toString()}`,
  )
  return response.data ?? null
}

export async function getSearchHistoryById(
  id: number,
): Promise<SearchHistoryItem | null> {
  const params = new URLSearchParams()
  params.set('id', String(id))
  const response = await fetcher<ApiResponse<SearchHistoryItem | null>>(
    `/api/search-history?${params.toString()}`,
  )
  return response.data ?? null
}

export async function saveSearchHistory(
  input: SaveSearchInput,
): Promise<SearchHistoryItem | null> {
  const response = await fetcher<ApiResponse<SearchHistoryItem>>(
    '/api/search-history',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  return response.data ?? null
}

export async function deleteSearchHistory(urlPath: string): Promise<boolean> {
  const params = new URLSearchParams()
  params.set('urlPath', urlPath)
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/search-history?${params.toString()}`,
    {
      method: 'DELETE',
    },
  )
  return response.data?.success ?? false
}
