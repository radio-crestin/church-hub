import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AlertCircle, Check, GripVertical, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useBooks, useDefaultBibleTranslation } from '~/features/bible/hooks'
import {
  type ParsedPassageRange,
  parsePassageRange,
} from '~/features/bible/utils/parsePassageRange'

export interface LocalVerseteTineriEntry {
  id: string | number
  personName: string
  referenceInput: string
  parsedResult: ParsedPassageRange | null
  sortOrder: number
}

interface VerseteTineriEntryRowProps {
  entry: LocalVerseteTineriEntry
  index: number
  onPersonNameChange: (personName: string) => void
  onReferenceChange: (
    referenceInput: string,
    parsed: ParsedPassageRange | null,
  ) => void
  onDelete: () => void
}

export function VerseteTineriEntryRow({
  entry,
  index,
  onPersonNameChange,
  onReferenceChange,
  onDelete,
}: VerseteTineriEntryRowProps) {
  const { t } = useTranslation('queue')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Get default translation and books for parsing
  const { translation: selectedTranslation } = useDefaultBibleTranslation()
  const { data: books = [] } = useBooks(selectedTranslation?.id ?? 0)

  // Local reference input for immediate feedback
  const [localReference, setLocalReference] = useState(entry.referenceInput)

  // Debounced parsing
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!localReference.trim()) {
        onReferenceChange(localReference, null)
        return
      }

      if (books.length === 0) return

      // Normalize input: allow "Ioan 3 16" to be parsed as "Ioan 3:16"
      // Replace space between consecutive numbers with a colon
      const normalizedInput = localReference.replace(/(\d+)\s+(\d+)/g, '$1:$2')

      const result = parsePassageRange({
        input: normalizedInput,
        books,
      })
      onReferenceChange(localReference, result)
    }, 300)

    return () => clearTimeout(timeout)
  }, [localReference, books, onReferenceChange])

  const isValid = entry.parsedResult?.status === 'valid'
  const hasError = entry.parsedResult && entry.parsedResult.status !== 'valid'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 mt-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </button>

      {/* Entry number */}
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-2 flex-shrink-0 w-6">
        {index + 1}.
      </span>

      {/* Form fields */}
      <div className="flex-1 space-y-2">
        {/* Person name */}
        <input
          type="text"
          value={entry.personName}
          onChange={(e) => onPersonNameChange(e.target.value)}
          placeholder={t('verseteTineri.personNamePlaceholder')}
          className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />

        {/* Bible reference */}
        <div className="space-y-1">
          <input
            type="text"
            value={localReference}
            onChange={(e) => setLocalReference(e.target.value)}
            placeholder={t('biblePassage.referencePlaceholder')}
            className={`w-full px-3 py-1.5 text-sm border rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:border-transparent ${
              hasError
                ? 'border-red-300 dark:border-red-600 focus:ring-red-500'
                : isValid
                  ? 'border-teal-300 dark:border-teal-600 focus:ring-teal-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-indigo-500'
            }`}
          />

          {/* Validation feedback */}
          {entry.parsedResult && (
            <div className="flex items-center gap-1 text-xs">
              {isValid ? (
                <>
                  <Check
                    size={12}
                    className="text-teal-600 dark:text-teal-400"
                  />
                  <span className="text-teal-700 dark:text-teal-300">
                    {entry.parsedResult.formattedReference}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle size={12} className="text-red-500" />
                  <span className="text-red-600 dark:text-red-400">
                    {t(entry.parsedResult.errorKey!)}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={onDelete}
        className="p-1.5 mt-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors flex-shrink-0"
        title={t('verseteTineri.removeEntry')}
      >
        <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
      </button>
    </div>
  )
}
