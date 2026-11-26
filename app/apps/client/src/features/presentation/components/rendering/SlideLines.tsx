import type { SlideLine } from './utils/splitSlideLines'

const HIDDEN: React.CSSProperties = { visibility: 'hidden' }

interface SlideLinesProps {
  lines: SlideLine[]
  /** A React key per line (keySlideLines), so a shared line keeps its node */
  keys: string[]
  /** Lines laid out but not drawn (the lines a leaving copy doesn't animate) */
  hidden?: boolean[]
  /** Collects each line's element by its key */
  lineRef?: (key: string, line: HTMLDivElement | null) => void
}

/**
 * A slide's text, one block per line, so each line can animate on its own
 * when only some lines change. Lays out exactly like the text as one block:
 * every line keeps its line break and the text wraps with `pre-wrap`.
 */
export function SlideLines({ lines, keys, hidden, lineRef }: SlideLinesProps) {
  return (
    <div>
      {lines.map((line, index) => {
        const key = keys[index]
        const props = {
          ref: lineRef ? (el: HTMLDivElement | null) => lineRef(key, el) : null,
          'data-line': '',
          style: hidden?.[index] ? HIDDEN : undefined,
        }
        return line.html === null ? (
          <div key={key} {...props}>
            {line.shown}
          </div>
        ) : (
          <div
            key={key}
            {...props}
            dangerouslySetInnerHTML={{ __html: line.html }}
          />
        )
      })}
    </div>
  )
}
