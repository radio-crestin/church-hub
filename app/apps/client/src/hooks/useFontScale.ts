import { useCallback, useMemo } from 'react'

import { useDividerPosition } from './useDividerPosition'

const MIN_SCALE = 0.8
const MAX_SCALE = 2.2
const STEP = 0.1

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(scale * 100) / 100))
}

/**
 * Reader-controlled text size for a list the operator reads from (song
 * lyrics, Bible verses), scaled from `baseRem` in steps and remembered per
 * device under `storageKey`, like the panel dividers.
 */
export function useFontScale(storageKey: string, baseRem: number) {
  const [rawScale, setScale] = useDividerPosition(storageKey, 1)
  const scale = clampScale(rawScale)

  const textStyle = useMemo(
    () => ({ fontSize: `${baseRem * scale}rem`, lineHeight: 1.4 }),
    [baseRem, scale],
  )
  const decrease = useCallback(
    () => setScale(clampScale(scale - STEP)),
    [scale, setScale],
  )
  const increase = useCallback(
    () => setScale(clampScale(scale + STEP)),
    [scale, setScale],
  )

  return {
    textStyle,
    decrease,
    increase,
    canDecrease: scale > MIN_SCALE,
    canIncrease: scale < MAX_SCALE,
  }
}
