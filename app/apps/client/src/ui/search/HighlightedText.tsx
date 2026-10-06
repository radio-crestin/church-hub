import { useMemo } from 'react'

import { splitMarkedText } from './splitMarkedText'

interface HighlightedTextProps {
  /** Search result text from the server, with <mark>…</mark> around matches. */
  text: string
}

/**
 * Shows a search result's text with its matches highlighted. Rendered as
 * React text and <mark> elements, never as HTML, so markup inside a title,
 * lyrics or a verse shows as typed and can never run.
 */
export function HighlightedText({ text }: HighlightedTextProps) {
  const parts = useMemo(() => splitMarkedText(text), [text])
  return parts.map((part, index) =>
    part.marked ? <mark key={index}>{part.text}</mark> : part.text,
  )
}
