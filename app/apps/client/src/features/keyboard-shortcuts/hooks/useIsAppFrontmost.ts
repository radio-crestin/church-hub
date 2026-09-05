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
 * Only the control window mounts this (display windows render a layout without
 * the shortcut manager), so watching that window's focus catches every switch
 * to and from another application; the check itself covers all our windows, so
 * a projection taking the keyboard still counts as Church Hub being in front.
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
    let stopListening: (() => void) | undefined

    const settle = () => {
      if (settleTimer) clearTimeout(settleTimer)
      settleTimer = setTimeout(async () => {
        const frontmost = await isAppFrontmost()
        if (!isCancelled) setIsFrontmost(frontmost)
      }, FOCUS_SETTLE_MS)
    }

    void (async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const unlisten = await getCurrentWindow().onFocusChanged(settle)
      if (isCancelled) {
        unlisten()
        return
      }
      stopListening = unlisten
      settle()
    })()

    return () => {
      isCancelled = true
      if (settleTimer) clearTimeout(settleTimer)
      stopListening?.()
    }
  }, [])

  return isFrontmost
}
