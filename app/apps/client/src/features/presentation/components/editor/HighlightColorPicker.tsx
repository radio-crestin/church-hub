import type { Editor } from '@tiptap/react'
import { Highlighter, Settings } from 'lucide-react'
import { useRef, useState } from 'react'

import { useHighlightColors } from '../../hooks/useHighlightColors'

interface HighlightColorPickerProps {
  editor: Editor
  onManageColors: () => void
}

export function HighlightColorPicker({
  editor,
  onManageColors,
}: HighlightColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { data: colors = [] } = useHighlightColors()

  const handleColorSelect = (color: string) => {
    editor.chain().focus().toggleHighlight({ color }).run()
    setIsOpen(false)
  }

  const handleRemoveHighlight = () => {
    editor.chain().focus().unsetHighlight().run()
    setIsOpen(false)
  }

  const isHighlightActive = editor.isActive('highlight')

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-2 py-1 rounded text-sm flex items-center gap-1 ${
          isHighlightActive
            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
        }`}
        title="Highlight"
      >
        <Highlighter size={16} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
          />

          {/* Dropdown menu */}
          <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 min-w-[160px]">
            {/* Color options */}
            <div className="flex flex-wrap gap-1 mb-2">
              {colors.map((highlightColor) => (
                <button
                  key={highlightColor.id}
                  type="button"
                  onClick={() => handleColorSelect(highlightColor.color)}
                  className="w-7 h-7 rounded border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                  style={{ backgroundColor: highlightColor.color }}
                  title={highlightColor.name}
                />
              ))}
            </div>

            {/* Remove highlight button */}
            {isHighlightActive && (
              <button
                type="button"
                onClick={handleRemoveHighlight}
                className="w-full px-2 py-1 text-sm text-left text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                Remove highlight
              </button>
            )}

            {/* Manage colors link */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                onManageColors()
              }}
              className="w-full px-2 py-1 text-sm text-left text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2"
            >
              <Settings size={14} />
              Manage colors
            </button>
          </div>
        </>
      )}
    </div>
  )
}
