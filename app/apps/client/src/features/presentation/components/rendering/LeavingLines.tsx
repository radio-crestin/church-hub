import { useLayoutEffect, useRef } from 'react'

import { SlideLines } from './SlideLines'
import type { SlideAnimationConfig } from './useSlideAnimation'
import { animateLineOut } from './utils/animateLineOut'
import type { SlideLine } from './utils/splitSlideLines'

/** The lines one slide change took away, fading out where they were. */
export interface LeavingLinesData {
  id: number
  lines: SlideLine[]
  keys: string[]
  /** Per line: whether it leaves (drawn and fading out) or stays hidden */
  leaves: boolean[]
  /** Per line: the opacity it leaves from */
  fromOpacity: number[]
  /** The text's fitted size, so the lines sit exactly where they were */
  fontSize: number
}

interface LeavingLinesProps {
  data: LeavingLinesData
  /** The text's styles, laid out like the text itself */
  textStyle: React.CSSProperties
  exit: SlideAnimationConfig
}

const OVERLAY: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
}

/**
 * The previous slide's text over the new one, every line hidden except the
 * ones that left, which play the slide's exit transition in place. Outside the
 * selectable text and hidden from assistive tech, like a leaving slide.
 */
export function LeavingLines({ data, textStyle, exit }: LeavingLinesProps) {
  const lineEls = useRef(new Map<string, HTMLDivElement>())

  useLayoutEffect(() => {
    data.keys.forEach((key, index) => {
      const line = lineEls.current.get(key)
      if (line && data.leaves[index]) {
        animateLineOut(line, exit, data.fromOpacity[index])
      }
    })
    // Plays once, when these lines start leaving
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
        keys={data.keys}
        hidden={data.leaves.map((leaves) => !leaves)}
        lineRef={(key, line) => {
          if (line) lineEls.current.set(key, line)
          else lineEls.current.delete(key)
        }}
      />
    </div>
  )
}
