import { memo } from 'react'

interface SlideNumberGutterProps {
  /** The line each slide starts on. */
  startLines: number[]
  /** The slide the caret is in, numbered in colour. */
  activeSlide: number
  lineHeight: number
  paddingTop: number
}

/**
 * The slide numbers beside the song's text: a small, quiet number on the
 * first line of each slide, the one being typed in picked out. Memoised, so
 * typing inside a slide never renders it.
 */
export const SlideNumberGutter = memo(function SlideNumberGutter({
  startLines,
  activeSlide,
  lineHeight,
  paddingTop,
}: SlideNumberGutterProps) {
  return (
    <>
      {startLines.map((line, index) => (
        <span
          key={line}
          data-testid="song-text-slide-number"
          className={`absolute right-2 text-[11px] font-medium tabular-nums select-none ${
            index === activeSlide ? 'text-fg' : 'text-fg-hint'
          }`}
          style={{
            top: paddingTop + line * lineHeight,
            lineHeight: `${lineHeight}px`,
          }}
        >
          {index + 1}
        </span>
      ))}
    </>
  )
})
