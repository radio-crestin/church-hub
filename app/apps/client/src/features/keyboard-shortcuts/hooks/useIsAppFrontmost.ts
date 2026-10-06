import { useEffect, useState } from 'react'

import { isAppFrontmost } from '~/utils/isAppFrontmost'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/**
 * How long focus has to have settled before the answer changes. Focus moves
 * between our own windows while a projection comes up, and each hop would
 * otherwise re-register every shortcut.
 */
const FOCUS_SETTLE_MS = 250

/**
 * Whether Church Hub is the application the user is working in.
 *
 * The answer is asked again whenever ANY Church Hub window gains or loses
 * focus, projections and page windows included. Watching only this window's
 * focus left it stale: with a projection holding the keyboard, switching to
 * another program fired no event here, so Church Hub still counted as in
 * front and kept holding its keys over that program.
 *
 * Outside Tauri there is no other application to lose the keyboard to, so the
 * answer is always yes.
 */
export function useIsAppFrontmost(): boolean {
  const [isFrontmost, setIsFrontmost] = useState(true)

  useEffect(() => {
    if (!isTauri) return

    let isCancelled = false
    let settleTimer: ReturnType<typeof setTimeout> | undefined
    const stopListening: Array<() => void> = []

    const settle = () => {
      if (settleTimer) clearTimeout(settleTimer)
      settleTimer = setTimeout(async () => {
        const frontmost = await isAppFrontmost()
        if (!isCancelled) setIsFrontmost(frontmost)
      }, FOCUS_SETTLE_MS)
    }

    void (async () => {
      const { listen, TauriEvent } = await import('@tauri-apps/api/event')
      // `listen` with no target hears the event from every window
      const unlisteners = await Promise.all([
        listen(TauriEvent.WINDOW_FOCUS, settle),
        listen(TauriEvent.WINDOW_BLUR, settle),
      ])
      if (isCancelled) {
        for (const unlisten of unlisteners) unlisten()
        return
      }
      stopListening.push(...unlisteners)
      settle()
    })()

    return () => {
      isCancelled = true
      if (settleTimer) clearTimeout(settleTimer)
      for (const unlisten of stopListening) unlisten()
    }
  }, [])

  return isFrontmost
}
