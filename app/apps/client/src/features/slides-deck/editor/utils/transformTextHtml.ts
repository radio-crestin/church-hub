import { type ChainedCommands, Editor } from '@tiptap/core'

import { deckTextExtensions } from './deckTextExtensions'

/**
 * A text box's whole HTML changed by a text editor command (bold, italic,
 * alignment, bullets) when it is not being edited in place.
 */
export function transformTextHtml(
  html: string,
  command: (chain: ChainedCommands) => ChainedCommands,
): string {
  const editor = new Editor({ extensions: deckTextExtensions(), content: html })
  command(editor.chain().selectAll()).run()
  const result = editor.getHTML()
  editor.destroy()
  return result
}
