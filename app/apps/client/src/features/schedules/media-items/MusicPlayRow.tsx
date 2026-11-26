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
      className="w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 hover:bg-hover"
    >
      <Play size={16} strokeWidth={1.5} className="shrink-0 text-fg-hint" />
      <span className="text-[13px] text-fg-body">
        {t('mediaItems.music.playNow')}
      </span>
    </button>
  )
}
