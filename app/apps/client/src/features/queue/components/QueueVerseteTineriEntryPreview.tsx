import { useRef } from 'react'

import { useScrollIntoViewWithNeighbors } from '../hooks'
import type { VerseteTineriEntry } from '../types'

interface QueueVerseteTineriEntryPreviewProps {
  entry: VerseteTineriEntry
  entryIndex: number
  isActive: boolean
  onClick: () => void
}

export function QueueVerseteTineriEntryPreview({
  entry,
  entryIndex,
  isActive,
  onClick,
}: QueueVerseteTineriEntryPreviewProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)

  useScrollIntoViewWithNeighbors(buttonRef, isActive)

  // Truncate verse text for preview
  const previewText =
    entry.text.length > 80 ? `${entry.text.slice(0, 80)}...` : entry.text

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      className={`w-full text-left p-2 pl-10 rounded-lg border transition-all ${
        isActive
          ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Entry Number */}
        <div
          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
            isActive
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}
        >
          {entryIndex + 1}
        </div>

        {/* Entry Preview - Bible verse style */}
        <div className="flex-1 min-w-0">
          {/* Reference (like Bible verse display) */}
          <div
            className={`text-xs font-medium mb-0.5 ${
              isActive
                ? 'text-purple-700 dark:text-purple-300'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {entry.reference}
          </div>
          {/* Verse text */}
          <div
            className={`text-sm line-clamp-2 ${
              isActive
                ? 'text-purple-900 dark:text-purple-100'
                : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            {previewText}
          </div>
          {/* Person name (secondary info) */}
          <div
            className={`text-xs mt-1 italic ${
              isActive
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {entry.personName}
          </div>
        </div>
      </div>
    </button>
  )
}
