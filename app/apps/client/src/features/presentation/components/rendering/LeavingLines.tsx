import { useCallback, useLayoutEffect, useRef } from 'react'

import { SlideLines } from './SlideLines'
import type { SlideAnimationConfig } from './useSlideAnimation'
import { animateOut } from './utils/animateOut'
import type { SlideLine } from './utils/splitSlideLines'

/** The words one slide change took away, fading out where they were. */
export interface LeavingLinesData {
  id: number
  lines: SlideLine[]
  lineKeys: string[]
  tokenKeys: string[][]
  /** Per word: whether it leaves (drawn and fading out) or stays hidden */
  leaves: boolean[][]
  /** Per word: the opacity it leaves from */
  fromOpacity: number[][]
  /** The text's fitted size, so the words sit exactly where they were */
  fontSize: number
}

interface LeavingLinesProps {
  data: LeavingLinesData
  /** The text's styles, laid out like the text itself */
  textStyle: React.CSSProperties
  underline?: boolean
  exit: SlideAnimationConfig
}

const OVERLAY: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
}

/**
 * The previous slide's text over the new one, every word hidden except the
 * ones that left (whole lines or single words), which play the slide's exit
 * transition in place. Outside the selectable text and hidden from assistive
 * tech, like a leaving slide.
 */
export function LeavingLines({
  data,
  textStyle,
  underline,
  exit,
}: LeavingLinesProps) {
  const units = useRef(new Map<string, HTMLElement>())
  const unitRef = useCallback((key: string, element: HTMLElement | null) => {
    if (element) units.current.set(key, element)
    else units.current.delete(key)
  }, [])

  useLayoutEffect(() => {
    data.tokenKeys.forEach((keys, line) => {
      keys.forEach((key, token) => {
        const element = units.current.get(key)
        if (element && data.leaves[line][token]) {
          animateOut(element, exit, data.fromOpacity[line][token])
        }
      })
    })
    // Plays once, when these words start leaving
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      aria-hidden="true"
      data-leaving-lines=""
      style={{ ...textStyle, ...OVERLAY, fontSize: `${data.fontSize}px` }}
    >
      <SlideLines
        lines={data.lines}
        lineKeys={data.lineKeys}
        tokenKeys={data.tokenKeys}
        hidden={data.leaves.map((line) => line.map((leaves) => !leaves))}
        underline={underline}
        unitRef={unitRef}
      />
    </div>
  )
}
