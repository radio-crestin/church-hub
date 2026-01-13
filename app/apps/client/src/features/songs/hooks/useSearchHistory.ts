import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  deleteSearchHistory,
  getSearchHistory,
  getSearchHistoryById,
  type SaveSearchInput,
  type SearchHistoryItem,
  saveSearchHistory,
} from '../service/searchHistory'

export function useSearchHistory(urlPath: string | null) {
  return useQuery<SearchHistoryItem | null>({
    queryKey: ['searchHistory', urlPath],
    queryFn: () => (urlPath ? getSearchHistory(urlPath) : null),
    enabled: !!urlPath,
    staleTime: 30 * 1000,
  })
}

export function useSearchHistoryById(id: number | null | undefined) {
  return useQuery<SearchHistoryItem | null>({
    queryKey: ['searchHistoryById', id],
    queryFn: () => (id ? getSearchHistoryById(id) : null),
    enabled: !!id,
    staleTime: 30 * 1000,
  })
}

export function useSaveSearchHistory() {
  const queryClient = useQueryClient()

  return useMutation<SearchHistoryItem | null, Error, SaveSearchInput>({
    mutationFn: saveSearchHistory,
    onSuccess: (data, variables) => {
      if (data) {
        queryClient.setQueryData(['searchHistory', variables.urlPath], data)
      }
    },
  })
}

export function useDeleteSearchHistory() {
  const queryClient = useQueryClient()

  return useMutation<boolean, Error, string>({
    mutationFn: deleteSearchHistory,
    onSuccess: (_, urlPath) => {
      queryClient.setQueryData(['searchHistory', urlPath], null)
    },
  })
}
