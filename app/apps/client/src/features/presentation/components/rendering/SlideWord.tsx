import { memo, useCallback } from 'react'

interface SlideWordProps {
  /** The word (or the spaces after it), as text */
  text: string
  /** The same with its styling markup, or null when it has none */
  html: string | null
  /** A word or part of one, drawn as its own element so it can fade */
  isWord: boolean
  /** Drawn as an inline block so it can glide (SlideToken.glides) */
  glides: boolean
  /** Laid out but not drawn */
  hidden?: boolean
  /** A word box doesn't take its line's underline, so it draws its own */
  underline?: boolean
  unitKey: string
  unitRef?: (key: string, element: HTMLElement | null) => void
}

/**
 * One word of a slide. Memoised on plain values, so a slide change re-renders
 * only the words that changed, never the ones it keeps.
 */
export const SlideWord = memo(function SlideWord({
  text,
  html,
  isWord,
  glides,
  hidden,
  underline,
  unitKey,
  unitRef,
}: SlideWordProps) {
  const ref = useCallback(
    (element: HTMLElement | null) => unitRef?.(unitKey, element),
    [unitKey, unitRef],
  )
  // Plain spaces, and a text not cut into words, stay bare text, exactly as
  // the text was drawn before words could animate
  if (!isWord && html === null) return text

  const style: React.CSSProperties = {
    display: glides ? 'inline-block' : undefined,
    textDecoration: glides && underline ? 'underline' : undefined,
    visibility: hidden ? 'hidden' : undefined,
  }
  return html === null ? (
    <span ref={ref} data-token="" style={style}>
      {text}
    </span>
  ) : (
    <span
      ref={ref}
      data-token=""
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})
