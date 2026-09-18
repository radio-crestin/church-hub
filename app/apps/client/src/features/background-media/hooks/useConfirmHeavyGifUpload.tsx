import { useCallback, useRef, useState } from 'react'

import { createLogger } from '~/utils/logger'
import { HeavyGifWarningModal } from '../components/HeavyGifWarningModal'
import {
  findHeavyAnimatedGifs,
  type HeavyAnimatedGif,
} from '../utils/findHeavyAnimatedGifs'

const logger = createLogger('app:background-media')

/**
 * Asks before uploading heavy animated GIFs, which play choppy or freeze on
 * screens. `confirmUpload(files)` resolves true at once when none of the
 * files is one; otherwise it opens the warning (render `modal`) and resolves
 * with the user's answer: true for "Upload anyway", false for Cancel.
 */
export function useConfirmHeavyGifUpload() {
  const [heavyGifs, setHeavyGifs] = useState<HeavyAnimatedGif[]>([])
  const resolveRef = useRef<((proceed: boolean) => void) | null>(null)

  const confirmUpload = useCallback(async (files: File[]) => {
    const found = await findHeavyAnimatedGifs(files)
    if (found.length === 0) return true

    logger.debug(
      `Warning before uploading ${found.length} heavy animated GIF(s)`,
      found.map(({ name, size, frameCount }) => ({ name, size, frameCount })),
    )
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setHeavyGifs(found)
    })
  }, [])

  // Closing the dialog reports a cancel after a confirm too: only the first
  // answer counts.
  const answer = (proceed: boolean) => {
    const resolve = resolveRef.current
    if (!resolve) return
    resolveRef.current = null
    logger.debug(`Heavy GIF upload ${proceed ? 'confirmed' : 'cancelled'}`)
    setHeavyGifs([])
    resolve(proceed)
  }

  const modal = (
    <HeavyGifWarningModal
      gifs={heavyGifs}
      onConfirm={() => answer(true)}
      onCancel={() => answer(false)}
    />
  )

  return { confirmUpload, modal }
}
