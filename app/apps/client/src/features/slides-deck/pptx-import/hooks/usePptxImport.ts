import { useCallback, useRef, useState } from 'react'

import { createLogger } from '~/utils/logger'
import { importPptx } from '../importPptx'
import type { PptxImportProgress, PptxImportResult } from '../types'

const logger = createLogger('app:slides-deck:pptx-import')

/** Where an import is: reading, uploading, saving, done (with its summary), or failed. */
export type PptxImportState =
  | { status: 'idle' }
  | { status: 'working'; progress: PptxImportProgress | { phase: 'saving' } }
  | { status: 'done'; result: PptxImportResult }
  /** The file could not be read, or the slides could not be saved. */
  | { status: 'error'; failed: 'read' | 'save' }

/** A PowerPoint import's file input, state and steps (PptxImportDialog shows them). */
export interface PptxImport {
  inputRef: React.RefObject<HTMLInputElement | null>
  state: PptxImportState
  /** Opens the file chooser. */
  choose: () => void
  run: (file: File) => Promise<void>
  close: () => void
}

/**
 * Imports a chosen .pptx: reads it, uploads its media, then hands the deck to
 * `save` (adding an item, inserting slides), and keeps the summary to show.
 * `save` throws to report that it failed, with what to tell.
 */
export function usePptxImport(
  save: (result: PptxImportResult) => Promise<void>,
): PptxImport {
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<PptxImportState>({ status: 'idle' })

  const run = useCallback(
    async (file: File) => {
      let result: PptxImportResult
      try {
        result = await importPptx(file, (progress) =>
          setState({ status: 'working', progress }),
        )
      } catch (error) {
        logger.error(`Reading ${file.name} failed`, error)
        setState({ status: 'error', failed: 'read' })
        return
      }
      try {
        setState({ status: 'working', progress: { phase: 'saving' } })
        await save(result)
        setState({ status: 'done', result })
      } catch (error) {
        logger.error(`Saving the slides of ${file.name} failed`, error)
        setState({ status: 'error', failed: 'save' })
      }
    },
    [save],
  )

  return {
    inputRef,
    state,
    choose: useCallback(() => inputRef.current?.click(), []),
    run,
    close: useCallback(() => setState({ status: 'idle' }), []),
  }
}
