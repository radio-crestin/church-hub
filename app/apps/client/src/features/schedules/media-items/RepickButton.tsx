import { Shuffle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { repickSchedule } from './service/scheduleItemsApi'

interface RepickButtonProps {
  scheduleId: number
}

/**
 * Picks the presentation's random verses and videos again now, as a new run
 * or loop does; every page showing it reads the new picks.
 */
export function RepickButton({ scheduleId }: RepickButtonProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  return (
    <button
      type="button"
      data-testid="schedule-repick"
      onClick={() =>
        repickSchedule(scheduleId).catch(() =>
          showToast(t('messages.error'), 'error'),
        )
      }
      className="flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-xs text-fg-label hover:bg-hover hover:text-fg"
    >
      <Shuffle size={12} strokeWidth={2} />
      {t('mediaItems.pickAgain')}
    </button>
  )
}
