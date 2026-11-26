import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createLogger } from '~/utils/logger'
import { addItemToSchedule, getScheduleById } from '../service'
import { scheduleItemToAddInput } from '../utils/scheduleItemToAddInput'

const logger = createLogger('schedules:add-presentation-items')

interface AddPresentationItemsInput {
  /** The presentation the items are copied into. */
  scheduleId: number
  /** The presentation whose items are copied. */
  sourceId: number
  /** They go after this item, in their order; without it, at the end. */
  afterItemId?: number
}

/**
 * Copies a presentation's items into another one, in their order, and
 * resolves to how many were added.
 */
export function useAddPresentationItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      scheduleId,
      sourceId,
      afterItemId,
    }: AddPresentationItemsInput) => {
      const source = await getScheduleById(sourceId)
      if (!source) throw new Error(`Presentation ${sourceId} not found`)
      let after = afterItemId
      let added = 0
      for (const item of source.items) {
        const input = scheduleItemToAddInput(item)
        if (!input) {
          logger.warn(`Skipped item ${item.id} (${item.itemType})`)
          continue
        }
        const result = await addItemToSchedule(scheduleId, {
          ...input,
          afterItemId: after,
        })
        if (!result.success || !result.data) {
          throw new Error(result.error ?? `Item ${item.id} not added`)
        }
        // Each copy follows the one before it, so their order is kept.
        if (after !== undefined) after = result.data.id
        added++
      }
      return added
    },
    onSettled: (_, __, { scheduleId }) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] })
    },
  })
}
