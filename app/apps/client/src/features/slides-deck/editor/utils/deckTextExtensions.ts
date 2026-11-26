import type { Extensions } from '@tiptap/core'
import TextAlign from '@tiptap/extension-text-align'
import {
  Color,
  FontFamily,
  FontSize,
  LineHeight,
  TextStyle,
} from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'

import { DeckBlockMargins } from './deckBlockMargins'

const BLOCKS = ['paragraph', 'listItem']

/**
 * The text editor's features, kept to what a deck's text may hold (the
 * server's sanitizeDeckHtml): paragraphs, line breaks, bold, italic,
 * underline, lists; a run's colour, font and size (`<span style>`); a
 * paragraph's alignment, line height, indent and spacing. No headings, code,
 * quotes, rules, strike or links. An imported PowerPoint text box keeps its
 * look when it is edited.
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
      // No empty paragraph added after a final list: an imported bullet
      // box keeps its paragraphs (a by-paragraph build counts them).
      trailingNode: false,
    }),
    TextAlign.configure({ types: BLOCKS }),
    TextStyle,
    Color,
    FontFamily,
    FontSize.configure({ types: ['textStyle', ...BLOCKS] }),
    LineHeight.configure({ types: BLOCKS }),
    DeckBlockMargins,
  ]
}
