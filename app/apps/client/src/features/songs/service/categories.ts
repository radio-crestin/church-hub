import { fetcher } from '~/utils/fetcher'
import type { SongCategory, UpsertCategoryInput } from '../types'

interface ApiResponse<T> {
  data?: T
  error?: string
}

export async function getAllCategories(): Promise<SongCategory[]> {
  const response = await fetcher<ApiResponse<SongCategory[]>>('/api/categories')
  return response.data ?? []
}

export async function upsertCategory(
  input: UpsertCategoryInput,
): Promise<{ success: boolean; category?: SongCategory; error?: string }> {
  const response = await fetcher<ApiResponse<SongCategory>>('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (response.error) {
    return { success: false, error: response.error }
  }

  return { success: true, category: response.data }
}

export async function deleteCategory(id: number): Promise<boolean> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    `/api/categories/${id}`,
    {
      method: 'DELETE',
    },
  )
  return response.data?.success ?? false
}

export async function deleteUncategorizedSongs(): Promise<{
  success: boolean
  deletedCount: number
}> {
  const response = await fetcher<
    ApiResponse<{ success: boolean; deletedCount: number }>
  >('/api/categories/uncategorized', {
    method: 'DELETE',
  })
  return response.data ?? { success: false, deletedCount: 0 }
}

export async function reorderCategories(
  categoryIds: number[],
): Promise<{ success: boolean; error?: string }> {
  const response = await fetcher<ApiResponse<{ success: boolean }>>(
    '/api/categories/reorder',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryIds }),
    },
  )

  if (response.error) {
    return { success: false, error: response.error }
  }

  return { success: true }
}
