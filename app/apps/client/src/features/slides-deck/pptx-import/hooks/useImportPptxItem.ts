import { useCallback, useRef } from 'react'

import { useAddItemToSchedule } from '~/features/schedules/hooks/useAddItemToSchedule'
import { type PptxImport, usePptxImport } from './usePptxImport'
import type { PptxImportResult } from '../types'

/**
 * "Import PowerPoint" in a presentation's Add menu: a chosen .pptx becomes a
 * Slides item, at the end or after `afterItemId`.
 */
export function useImportPptxItem(
  scheduleId: number,
  onAdded?: () => void,
): { pptx: PptxImport; importPptx: (afterItemId?: number) => void } {
  const addItem = useAddItemToSchedule()
  const afterRef = useRef<number | undefined>(undefined)
  const save = useCallback(
    async ({ deck }: PptxImportResult) => {
      const result = await addItem.mutateAsync({
        scheduleId,
        input: { slides: deck, afterItemId: afterRef.current },
      })
      if (!result.success) throw new Error(result.error ?? 'Not added')
      onAdded?.()
    },
    [addItem, onAdded, scheduleId],
  )
  const pptx = usePptxImport(save)
  const importPptx = useCallback(
    (afterItemId?: number) => {
      afterRef.current = afterItemId
      pptx.choose()
    },
    [pptx],
  )
  return { pptx, importPptx }
}
