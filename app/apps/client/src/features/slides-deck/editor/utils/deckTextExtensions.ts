import type { Extensions } from '@tiptap/core'
import TextAlign from '@tiptap/extension-text-align'
import StarterKit from '@tiptap/starter-kit'

/**
 * The text editor's features, kept to what a deck's text may hold (the
 * server's sanitizeDeckHtml): paragraphs, line breaks, bold, italic,
 * underline, lists and alignment; no headings, code, quotes, rules, strike
 * or links.
 */
export function deckTextExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: false,
      code: false,
      codeBlock: false,
      blockquote: false,
      horizontalRule: false,
      strike: false,
      link: false,
    }),
    TextAlign.configure({ types: ['paragraph'] }),
  ]
}
