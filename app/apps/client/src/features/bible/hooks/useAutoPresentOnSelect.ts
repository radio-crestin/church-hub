import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getSetting, upsertSetting } from '~/service/settings'

const AUTO_PRESENT_KEY = 'bible_auto_present_on_select'

/**
 * Whether picking a verse (search results, History, Bookmarks, a program's
 * passages) also puts it on screen, instead of only selecting it. Off by
 * default: the operator reads the verse in the preview first.
 */
export function useAutoPresentOnSelect() {
  const queryClient = useQueryClient()
  const queryKey = ['settings', AUTO_PRESENT_KEY]

  const query = useQuery({
    queryKey,
    queryFn: async () =>
      (await getSetting('app_settings', AUTO_PRESENT_KEY))?.value === 'true',
  })

  const mutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const saved = await upsertSetting('app_settings', {
        key: AUTO_PRESENT_KEY,
        value: String(enabled),
      })
      if (!saved) throw new Error('Failed to save the auto-present setting')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return { enabled: query.data ?? false, setEnabled: mutation.mutate }
}
