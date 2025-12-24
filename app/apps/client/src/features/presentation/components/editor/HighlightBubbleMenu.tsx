import { BubbleMenu, type Editor } from '@tiptap/react'

import { useHighlightColors } from '../../hooks/useHighlightColors'

interface HighlightBubbleMenuProps {
  editor: Editor
}

export function HighlightBubbleMenu({ editor }: HighlightBubbleMenuProps) {
  const { data: colors = [] } = useHighlightColors()

  const handleColorSelect = (color: string) => {
    editor.chain().focus().toggleHighlight({ color }).run()
  }

  const handleRemoveHighlight = () => {
    editor.chain().focus().unsetHighlight().run()
  }

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100 }}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-1 flex items-center gap-1"
    >
      {colors.map((highlightColor) => (
        <button
          key={highlightColor.id}
          type="button"
          onClick={() => handleColorSelect(highlightColor.color)}
          className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
          style={{ backgroundColor: highlightColor.color }}
          title={highlightColor.name}
        />
      ))}
      {editor.isActive('highlight') && (
        <button
          type="button"
          onClick={handleRemoveHighlight}
          className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          ✕
        </button>
      )}
    </BubbleMenu>
  )
}
