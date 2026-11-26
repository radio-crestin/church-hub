import { useCallback } from 'react'

import { SlideWord } from './SlideWord'
import type { SlideLine } from './utils/splitSlideLines'

interface SlideLinesProps {
  lines: SlideLine[]
  /** React keys (keySlideLines), so a kept line or word keeps its node */
  lineKeys: string[]
  tokenKeys: string[][]
  /** Words laid out but not drawn (what a leaving copy doesn't animate) */
  hidden?: boolean[][]
  /** Whether the text is underlined */
  underline?: boolean
  /** Collects each line's and word's element by its key */
  unitRef?: (key: string, element: HTMLElement | null) => void
}

/**
 * A slide's text, one block per line and one box per word, so a slide change
 * can animate single lines and words. Lays out like the text as one block:
 * the spaces stay inline between the words, every line keeps its line break,
 * and the text wraps with `pre-wrap`.
 */
export function SlideLines({
  lines,
  lineKeys,
  tokenKeys,
  hidden,
  underline,
  unitRef,
}: SlideLinesProps) {
  const lineRef = useCallback(
    (key: string) => (element: HTMLElement | null) => unitRef?.(key, element),
    [unitRef],
  )
  return (
    <div>
      {lines.map((line, index) => (
        <div key={lineKeys[index]} ref={lineRef(lineKeys[index])} data-line="">
          {line.tokens.map((token, i) => (
            <SlideWord
              key={tokenKeys[index][i]}
              unitKey={tokenKeys[index][i]}
              unitRef={unitRef}
              text={token.text}
              html={token.html}
              isWord={token.isWord}
              hidden={hidden?.[index]?.[i]}
              underline={underline}
            />
          ))}
          {line.breaks ? '\n' : null}
        </div>
      ))}
    </div>
  )
}
