import { Extension, getStyleProperty } from '@tiptap/core'

const MARGINS = {
  marginLeft: 'margin-left',
  marginTop: 'margin-top',
  marginBottom: 'margin-bottom',
} as const

/**
 * Keeps a paragraph's or list item's left indent and spacing above and below
 * (an imported PowerPoint paragraph's) through the text editor, as the inline
 * styles the deck allows (sanitizeDeckHtml).
 */
export const DeckBlockMargins = Extension.create({
  name: 'deckBlockMargins',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'listItem'],
        attributes: Object.fromEntries(
          Object.entries(MARGINS).map(([name, property]) => [
            name,
            {
              default: null,
              parseHTML: (element: HTMLElement) =>
                getStyleProperty(element, property),
              renderHTML: (attributes: Record<string, string | null>) =>
                attributes[name]
                  ? { style: `${property}: ${attributes[name]}` }
                  : {},
            },
          ]),
        ),
      },
    ]
  },
})
