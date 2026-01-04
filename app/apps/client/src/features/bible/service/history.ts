import { fetcher } from '../../../utils/fetcher'
import type { AddToHistoryInput, BibleHistoryItem } from '../types'

export async function getHistory(): Promise<BibleHistoryItem[]> {
  const response = await fetcher<{ data: BibleHistoryItem[] }>(
    '/api/bible-history',
  )
  return response.data ?? []
}

export async function addToHistory(
  input: AddToHistoryInput,
): Promise<BibleHistoryItem | null> {
  const response = await fetcher<{ data: BibleHistoryItem }>(
    '/api/bible-history',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
  return response.data ?? null
}

export async function clearHistory(): Promise<boolean> {
  const response = await fetcher<{ success: boolean }>('/api/bible-history', {
    method: 'DELETE',
  })
  return response.success ?? false
}
