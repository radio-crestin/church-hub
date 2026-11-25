import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { useAddItemToSchedule } from '~/features/schedules/hooks/useAddItemToSchedule'
import { useToast } from '~/ui/toast'
import { newTitleDeck } from '../utils/newTitleDeck'

/**
 * Adds a Slides item with one title slide to a presentation, at its end or
 * after `afterItemId`.
 */
export function useAddDeckItem(scheduleId: number, onAdded?: () => void) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const addItem = useAddItemToSchedule()

  return useCallback(
    (afterItemId?: number) => {
      addItem.mutate(
        {
          scheduleId,
          input: {
            slides: newTitleDeck(t('slidesDeck.titlePlaceholder')),
            afterItemId,
          },
        },
        {
          onSuccess: (result) => {
            if (!result.success) {
              showToast(t('messages.error'), 'error')
              return
            }
            showToast(t('messages.itemAdded'), 'success')
            onAdded?.()
          },
          onError: () => showToast(t('messages.error'), 'error'),
        },
      )
    },
    [addItem, onAdded, scheduleId, showToast, t],
  )
}
