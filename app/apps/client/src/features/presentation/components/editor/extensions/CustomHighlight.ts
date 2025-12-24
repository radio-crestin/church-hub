import Highlight from '@tiptap/extension-highlight'

/**
 * Custom Highlight extension that supports multiple colors
 * Extends the default TipTap Highlight extension with color support
 */
export const CustomHighlight = Highlight.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      multicolor: true,
    }
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      color: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute('data-color') ||
          element.style.backgroundColor ||
          null,
        renderHTML: (attributes) => {
          if (!attributes.color) {
            return {}
          }
          return {
            'data-color': attributes.color,
            style: `background-color: ${attributes.color}; padding: 0.125em 0.25em; border-radius: 0.25em;`,
          }
        },
      },
    }
  },
})
