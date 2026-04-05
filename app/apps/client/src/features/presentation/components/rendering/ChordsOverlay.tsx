import { useMemo } from 'react'

interface ChordMapping {
  wordIndex: number
  chord: string
}

interface ChordsOverlayProps {
  /** Raw HTML content of the slide */
  content: string
  /** Chord mappings for the slide */
  chords: ChordMapping[]
  /** Container width in pixels */
  width: number
  /** Container height in pixels */
  height: number
  /** Position left in pixels */
  left: number
  /** Position top in pixels */
  top: number
  /** Base font size from text style */
  baseFontSize: number
  /** Text color */
  color: string
  /** Font family */
  fontFamily: string
  /** Text alignment */
  alignment: 'left' | 'center' | 'right'
  /** Click handler for chord names */
  onChordClick?: (chord: string) => void
}

/** Extract plain text from HTML */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(p|div|h[1-6])[^>]*>/gi, '')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

interface LineWithChords {
  words: string[]
  chords: Map<number, string> // local word index -> chord name
}

export function ChordsOverlay({
  content,
  chords,
  width,
  height,
  left,
  top,
  baseFontSize,
  color,
  fontFamily,
  alignment,
  onChordClick,
}: ChordsOverlayProps) {
  const lines = useMemo(() => {
    const plainText = htmlToPlainText(content)
    if (!plainText) return []

    const chordMap = new Map<number, string>()
    for (const c of chords) {
      chordMap.set(c.wordIndex, c.chord)
    }

    const textLines = plainText.split('\n')
    let globalWordIndex = 0
    const result: LineWithChords[] = []

    for (const line of textLines) {
      const words = line.split(/\s+/).filter(Boolean)
      const lineChords = new Map<number, string>()

      for (let i = 0; i < words.length; i++) {
        const chord = chordMap.get(globalWordIndex)
        if (chord) {
          lineChords.set(i, chord)
        }
        globalWordIndex++
      }
      // Account for newline token
      globalWordIndex++
      result.push({ words, chords: lineChords })
    }

    return result
  }, [content, chords])

  const chordFontSize = Math.max(10, baseFontSize * 0.55)
  const lyricsFontSize = baseFontSize
  const lineGap = lyricsFontSize * 0.2

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        fontFamily,
        color,
        pointerEvents: 'auto',
      }}
    >
      {lines.map((line, lineIdx) => {
        if (line.words.length === 0) {
          return <div key={lineIdx} style={{ height: lyricsFontSize * 0.5 }} />
        }

        const hasChords = line.chords.size > 0

        return (
          <div
            key={lineIdx}
            style={{
              textAlign: alignment,
              marginBottom: lineGap,
            }}
          >
            {/* Chord line */}
            {hasChords && (
              <div
                style={{
                  fontSize: chordFontSize,
                  fontWeight: 'bold',
                  color: '#f59e0b',
                  lineHeight: 1.4,
                  whiteSpace: 'pre',
                  minHeight: chordFontSize * 1.4,
                }}
              >
                {line.words.map((word, wordIdx) => {
                  const chord = line.chords.get(wordIdx)
                  if (!chord) {
                    // Empty space to maintain alignment
                    return (
                      <span
                        key={wordIdx}
                        style={{
                          display: 'inline-block',
                          minWidth: `${word.length * 0.6}em`,
                          marginRight: '0.3em',
                          visibility: 'hidden',
                        }}
                      >
                        {word}
                      </span>
                    )
                  }
                  return (
                    <span
                      key={wordIdx}
                      data-chord={chord}
                      onClick={(e) => {
                        e.stopPropagation()
                        onChordClick?.(chord)
                      }}
                      style={{
                        display: 'inline-block',
                        minWidth: `${word.length * 0.6}em`,
                        marginRight: '0.3em',
                        cursor: 'pointer',
                      }}
                    >
                      {chord}
                    </span>
                  )
                })}
              </div>
            )}
            {/* Lyrics line */}
            <div
              style={{
                fontSize: lyricsFontSize,
                lineHeight: 1.3,
                whiteSpace: 'pre-wrap',
              }}
            >
              {line.words.join(' ')}
            </div>
          </div>
        )
      })}
    </div>
  )
}
