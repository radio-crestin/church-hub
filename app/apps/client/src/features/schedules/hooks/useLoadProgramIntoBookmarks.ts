import { useTranslation } from 'react-i18next'

import { useAddSongsToBookmarks } from '~/features/songs/hooks'
import { useToast } from '~/ui/toast'
import type { ScheduleItem } from '../types'

/** The program's songs in running order, each once. */
function programSongIds(items: ScheduleItem[]): number[] {
  const ids = items.flatMap((item) =>
    item.itemType === 'song' && item.songId ? [item.songId] : [],
  )
  return [...new Set(ids)]
}

/** Loads a program's songs into Marcaje and says how many were added. */
export function useLoadProgramIntoBookmarks(items: ScheduleItem[]) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const addSongs = useAddSongsToBookmarks()
  const songIds = programSongIds(items)

  async function load() {
    try {
      const { added } = await addSongs.mutateAsync(songIds)
      showToast(
        added > 0
          ? t('panel.loadedIntoBookmarks', { count: added })
          : t('panel.alreadyInBookmarks'),
        added > 0 ? 'success' : 'info',
      )
    } catch {
      showToast(t('messages.error'), 'error')
    }
  }

  return { load, songCount: songIds.length, isPending: addSongs.isPending }
}
