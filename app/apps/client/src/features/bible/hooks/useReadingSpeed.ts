import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { getSetting, upsertSetting } from '~/service/settings'

/** app_settings key the server's verse loop reads (verse-loop.ts). */
const READING_SPEED_KEY = 'bible_reading_speed'
export const DEFAULT_READING_SPEED = 160

/** Words per minute a looping bookmark slideshow gives each verse. */
export function useReadingSpeed() {
  const queryClient = useQueryClient()
  const queryKey = ['settings', READING_SPEED_KEY]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const value = Number(
        (await getSetting('app_settings', READING_SPEED_KEY))?.value,
      )
      return value > 0 ? value : DEFAULT_READING_SPEED
    },
  })

  const mutation = useMutation({
    mutationFn: async (wordsPerMinute: number) => {
      const saved = await upsertSetting('app_settings', {
        key: READING_SPEED_KEY,
        value: String(wordsPerMinute),
      })
      if (!saved) throw new Error('Failed to save the reading speed')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return {
    wordsPerMinute: query.data ?? DEFAULT_READING_SPEED,
    save: mutation.mutate,
  }
}
