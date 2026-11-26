import { useCallback, useEffect, useState } from 'react'

import { useFileDropZone } from '~/features/song-import'
import { createLogger } from '~/utils/logger'

const logger = createLogger('app:slides-deck:pptx-import')

/** A dropped .pptx waiting for the operator's choice. */
interface PendingDrop {
  file: File
  importAsSong: () => Promise<void>
}

/** The choice a .pptx dropped on a presentation's page asks for (PptxDropChoiceDialog). */
export interface PptxDropChoice {
  /** The page takes .pptx drops (they no longer go straight to songs). */
  ready: boolean
  pending: PendingDrop | null
  asSlides: () => void
  asSong: () => void
  cancel: () => void
}

/**
 * While a presentation's page is open, a .pptx dropped anywhere on the app
 * asks whether it becomes slides of this presentation (`importSlides`) or a
 * song, as it does on every other page (the app-wide FileDropZoneProvider).
 */
export function usePptxDropChoice(
  importSlides: (file: File) => void,
): PptxDropChoice {
  const { setPptxDropHandler } = useFileDropZone()
  const [pending, setPending] = useState<PendingDrop | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setPptxDropHandler((file, importAsSong) =>
      setPending({ file, importAsSong }),
    )
    setReady(true)
    return () => {
      setPptxDropHandler(null)
      setReady(false)
    }
  }, [setPptxDropHandler])

  return {
    ready,
    pending,
    asSlides: useCallback(() => {
      if (pending) importSlides(pending.file)
      setPending(null)
    }, [importSlides, pending]),
    asSong: useCallback(() => {
      pending
        ?.importAsSong()
        .catch((error: unknown) =>
          logger.error(`Song import of ${pending.file.name} failed`, error),
        )
      setPending(null)
    }, [pending]),
    cancel: useCallback(() => setPending(null), []),
  }
}
