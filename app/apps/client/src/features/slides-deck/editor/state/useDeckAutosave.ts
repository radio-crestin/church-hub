import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { setScheduleItemConfig } from '~/features/schedules/media-items/service/scheduleItemsApi'
import { createLogger } from '~/utils/logger'
import type { SlideDeck } from '../../types'

const logger = createLogger('app:slides-deck:autosave')

/** Saved this long after the last change. */
const DEBOUNCE_MS = 600

export type DeckSaveStatus = 'saved' | 'saving' | 'error'

/**
 * Saves the deck being edited through the item's settings a moment after
 * each change (and at once when the editor closes), so nothing is lost and
 * a slide on screen shows the edit (the server puts it up again).
 */
export function useDeckAutosave(
  scheduleId: number,
  itemId: number,
  deck: SlideDeck,
): DeckSaveStatus {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<DeckSaveStatus>('saved')
  const savedRef = useRef(deck)
  const pendingRef = useRef<SlideDeck | null>(null)
  // Saves one after another, so an older deck never lands after a newer one.
  const queueRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    if (deck === savedRef.current) return
    pendingRef.current = deck
    setStatus('saving')
    const save = async () => {
      const toSave = pendingRef.current
      if (!toSave) return
      pendingRef.current = null
      try {
        await setScheduleItemConfig(scheduleId, itemId, toSave)
        savedRef.current = toSave
        setStatus(pendingRef.current ? 'saving' : 'saved')
        queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] })
      } catch (error) {
        logger.error('Deck not saved', error)
        setStatus('error')
      }
    }
    const timer = setTimeout(() => {
      queueRef.current = queueRef.current.then(save)
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [deck, itemId, queryClient, scheduleId])

  // Closing the editor saves what is still waiting.
  useEffect(
    () => () => {
      const toSave = pendingRef.current
      if (!toSave) return
      setScheduleItemConfig(scheduleId, itemId, toSave)
        .then(() =>
          queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] }),
        )
        .catch((error: unknown) => logger.error('Deck not saved', error))
    },
    [itemId, queryClient, scheduleId],
  )

  return status
}
