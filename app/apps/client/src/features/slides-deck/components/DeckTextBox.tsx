import type { DeckTextElement } from '../types'

/** What a text box falls back to, like a white title on a dark slide. */
const DEFAULT_FONT_SIZE = 40
const DEFAULT_COLOR = '#ffffff'

const JUSTIFY = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }

/**
 * A text box on a deck slide: its HTML (sanitized by the server when saved),
 * its paragraphs stacked so a by-paragraph build can move each one
 * (`data-deck-text`).
 */
export function DeckTextBox({ element }: { element: DeckTextElement }) {
  return (
    <div
      data-deck-text={element.id}
      // Lists keep their bullets and numbers (the app's reset takes them off).
      className="flex h-full w-full flex-col overflow-hidden break-words [&_ol]:list-decimal [&_ol]:pl-[1.2em] [&_ul]:list-disc [&_ul]:pl-[1.2em]"
      style={{
        justifyContent: JUSTIFY[element.verticalAlign ?? 'top'],
        padding: element.padding ?? 0,
        fontFamily: element.fontFamily,
        fontSize:
          (element.fontSize ?? DEFAULT_FONT_SIZE) * (element.autofitScale ?? 1),
        color: element.color ?? DEFAULT_COLOR,
        lineHeight: 1.2,
      }}
      // Sanitized by the server when the deck was saved (sanitizeDeckHtml).
      dangerouslySetInnerHTML={{ __html: element.html }}
    />
  )
}
