import { useCallback } from 'react'

import { SlideWord } from './SlideWord'
import { groupWordPieces } from './utils/groupWordPieces'
import type { SlideLine } from './utils/splitSlideLines'

const NO_WRAP: React.CSSProperties = { whiteSpace: 'nowrap' }

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
  const renderToken = (line: number, token: number) => {
    const { text, html, isWord, glides } = lines[line].tokens[token]
    return (
      <SlideWord
        key={tokenKeys[line][token]}
        unitKey={tokenKeys[line][token]}
        unitRef={unitRef}
        text={text}
        html={html}
        isWord={isWord}
        glides={glides}
        hidden={hidden?.[line]?.[token]}
        underline={underline}
      />
    )
  }

  return (
    <div>
      {lines.map((line, index) => (
        <div key={lineKeys[index]} ref={lineRef(lineKeys[index])} data-line="">
          {groupWordPieces(line.tokens).map((group) =>
            group.length === 1 ? (
              renderToken(index, group[0])
            ) : (
              // The pieces of one word never wrap apart, as the word didn't
              <span key={`group:${tokenKeys[index][group[0]]}`} style={NO_WRAP}>
                {group.map((token) => renderToken(index, token))}
              </span>
            ),
          )}
          {line.breaks ? '\n' : null}
        </div>
      ))}
    </div>
  )
}
