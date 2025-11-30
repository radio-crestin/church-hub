import { mergeAttributes, Node } from '@tiptap/core'
import { Slice } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export interface SlideBreakOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    slideBreak: {
      setSlideBreak: () => ReturnType
      convertEmptyLinesToSlideBreaks: () => ReturnType
    }
  }
}

const slideBreakPluginKey = new PluginKey('slideBreakAutoConvert')

export const SlideBreak = Node.create<SlideBreakOptions>({
  name: 'slideBreak',

  group: 'block',

  atom: true,

  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-slide-break]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-slide-break': '',
        class: 'slide-break',
      }),
    ]
  },

  addCommands() {
    return {
      setSlideBreak:
        () =>
        ({ chain }) => {
          return chain().insertContent({ type: this.name }).run()
        },
      convertEmptyLinesToSlideBreaks:
        () =>
        ({ editor, tr }) => {
          const { doc } = tr
          const nodesToReplace: { from: number; to: number }[] = []

          doc.descendants((node, pos) => {
            if (node.type.name === 'paragraph' && node.content.size === 0) {
              nodesToReplace.push({
                from: pos,
                to: pos + node.nodeSize,
              })
            }
          })

          // Replace from end to start to maintain positions
          nodesToReplace.reverse().forEach(({ from, to }) => {
            editor
              .chain()
              .deleteRange({ from, to })
              .insertContentAt(from, { type: this.name })
              .run()
          })

          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { state } = editor
        const { selection } = state
        const { $from } = selection

        // Check if we're in an empty paragraph
        const currentNode = $from.parent
        if (
          currentNode.type.name === 'paragraph' &&
          currentNode.content.size === 0
        ) {
          // Check if the previous node is NOT a slideBreak (to allow empty lines after deletion)
          const pluginState = slideBreakPluginKey.getState(state)
          if (pluginState?.justDeleted) {
            return false
          }

          // Replace the empty paragraph with a slide break and add new paragraph below
          return editor
            .chain()
            .deleteNode('paragraph')
            .insertContent([{ type: this.name }, { type: 'paragraph' }])
            .focus()
            .run()
        }

        return false
      },
      Backspace: ({ editor }) => {
        const { state } = editor
        const { selection } = state
        const { $from } = selection

        // Check if we're at the start of a node right after a slide break
        if ($from.parentOffset === 0) {
          const posBefore = $from.before()
          if (posBefore > 0) {
            const nodeBefore = state.doc.resolve(posBefore).nodeBefore
            if (nodeBefore?.type.name === 'slideBreak') {
              // Delete the slide break and set flag
              editor
                .chain()
                .command(({ tr }) => {
                  tr.setMeta(slideBreakPluginKey, { justDeleted: true })
                  return true
                })
                .deleteRange({
                  from: posBefore - nodeBefore.nodeSize,
                  to: posBefore,
                })
                .run()
              return true
            }
          }
        }

        // Check if we're inside an empty paragraph with cursor at start
        const currentNode = $from.parent
        if (
          currentNode.type.name === 'paragraph' &&
          currentNode.content.size === 0
        ) {
          const posBefore = $from.before()
          if (posBefore > 0) {
            const resolved = state.doc.resolve(posBefore)
            const nodeBefore = resolved.nodeBefore
            if (nodeBefore?.type.name === 'slideBreak') {
              // Delete the slide break
              editor
                .chain()
                .command(({ tr }) => {
                  tr.setMeta(slideBreakPluginKey, { justDeleted: true })
                  return true
                })
                .deleteRange({
                  from: posBefore - nodeBefore.nodeSize,
                  to: posBefore,
                })
                .run()
              return true
            }
          }
        }

        return false
      },
    }
  },

  addProseMirrorPlugins() {
    const extensionThis = this

    return [
      new Plugin({
        key: slideBreakPluginKey,
        state: {
          init() {
            return { justDeleted: false }
          },
          apply(tr, value) {
            const meta = tr.getMeta(slideBreakPluginKey)
            if (meta?.justDeleted) {
              return { justDeleted: true }
            }

            // Only reset when user types actual text content
            if (value.justDeleted && tr.docChanged) {
              // Check if this is a text insertion (not just structural changes)
              let hasTextInput = false
              tr.steps.forEach((step) => {
                const stepJson = step.toJSON()
                // ReplaceStep with text content indicates typing
                if (
                  stepJson.stepType === 'replace' &&
                  stepJson.slice?.content
                ) {
                  const content = stepJson.slice.content
                  if (Array.isArray(content)) {
                    content.forEach(
                      (node: { type?: string; text?: string }) => {
                        if (
                          node.type === 'text' &&
                          node.text &&
                          node.text.length > 0
                        ) {
                          hasTextInput = true
                        }
                      },
                    )
                  }
                }
              })

              if (hasTextInput) {
                return { justDeleted: false }
              }
            }

            return value
          },
        },
        props: {
          handlePaste(view, event) {
            const text = event.clipboardData?.getData('text/plain')
            if (!text) return false

            // Only handle if text has empty lines (double newlines)
            const hasEmptyLines =
              text.includes('\n\n') || text.includes('\r\n\r\n')
            if (!hasEmptyLines) return false

            try {
              // Split by empty lines and create content
              const parts = text.split(/\n\s*\n|\r\n\s*\r\n/)
              const content: {
                type: string
                content?: { type: string; text: string }[]
              }[] = []

              parts.forEach((part, index) => {
                const trimmedPart = part.trim()
                if (trimmedPart) {
                  // Split by single newlines within the part
                  const lines = trimmedPart.split(/\n|\r\n/)
                  lines.forEach((line) => {
                    if (line.trim()) {
                      content.push({
                        type: 'paragraph',
                        content: [{ type: 'text', text: line.trim() }],
                      })
                    }
                  })
                }

                // Add slide break between parts (not after the last one)
                if (index < parts.length - 1) {
                  content.push({ type: extensionThis.name })
                }
              })

              if (content.length === 0) return false

              event.preventDefault()

              const { state, dispatch } = view
              const fragment = state.schema.nodeFromJSON({
                type: 'doc',
                content,
              }).content

              const tr = state.tr.replaceSelection(new Slice(fragment, 0, 0))
              dispatch(tr)

              return true
            } catch {
              // If anything fails, let default paste handler take over
              return false
            }
          },
        },
      }),
    ]
  },
})
