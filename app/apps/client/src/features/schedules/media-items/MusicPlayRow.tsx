import { Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { playMusicItem } from './service/scheduleItemsApi'
import type { ScheduleItem } from '../types'

interface MusicPlayRowProps {
  item: ScheduleItem
}

/**
 * A music item shows nothing on the screens: it starts as the presentation
 * reaches the step after it. This row plays it now, by hand.
 */
export function MusicPlayRow({ item }: MusicPlayRowProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()

  return (
    <button
      type="button"
      data-testid="schedule-music-play"
      onClick={() =>
        playMusicItem(item.scheduleId, item.id).then(
          () => showToast(t('mediaItems.music.playing'), 'success'),
          () => showToast(t('messages.error'), 'error'),
        )
      }
      className="w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-900/50"
    >
      <Play size={16} className="shrink-0 text-pink-500" />
      <span className="text-sm text-gray-700 dark:text-gray-300">
        {t('mediaItems.music.playNow')}
      </span>
    </button>
  )
}
