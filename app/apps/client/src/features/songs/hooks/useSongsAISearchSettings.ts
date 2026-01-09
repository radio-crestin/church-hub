import { useAISearchSettings } from '~/features/ai-search'

export function useSongsAISearchSettings() {
  return useAISearchSettings('songs_ai_search_config')
}
