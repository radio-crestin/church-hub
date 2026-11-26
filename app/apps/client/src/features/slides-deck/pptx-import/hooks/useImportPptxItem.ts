import { useCallback, useRef } from 'react'

import { useAddItemToSchedule } from '~/features/schedules/hooks/useAddItemToSchedule'
import { type PptxImport, usePptxImport } from './usePptxImport'
import type { PptxImportResult } from '../types'

/**
 * "Import PowerPoint" in a presentation's Add menu (or a .pptx dropped on it,
 * as slides): the file becomes a Slides item, at the end or after
 * `afterItemId`.
 */
export function useImportPptxItem(
  scheduleId: number,
  onAdded?: () => void,
): {
  pptx: PptxImport
  /** Opens the file chooser. */
  importPptx: (afterItemId?: number) => void
  /** Imports a file already at hand (a dropped one), at the end. */
  importPptxFile: (file: File) => void
} {
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
  const importPptxFile = useCallback(
    (file: File) => {
      afterRef.current = undefined
      void pptx.run(file)
    },
    [pptx],
  )
  return { pptx, importPptx, importPptxFile }
}
