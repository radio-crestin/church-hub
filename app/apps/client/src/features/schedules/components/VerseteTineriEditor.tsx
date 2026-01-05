import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus, Users } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import type { ParsedPassageRange } from '~/features/bible/utils/parsePassageRange'
import {
  type LocalVerseteTineriEntry,
  VerseteTineriEntryRow,
} from './VerseteTineriEntryRow'

interface VerseteTineriEditorProps {
  entries: LocalVerseteTineriEntry[]
  onEntriesChange: (entries: LocalVerseteTineriEntry[]) => void
}

export function VerseteTineriEditor({
  entries,
  onEntriesChange,
}: VerseteTineriEditorProps) {
  const { t } = useTranslation('schedules')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = entries.findIndex((e) => e.id === active.id)
      const newIndex = entries.findIndex((e) => e.id === over.id)

      const newOrder = arrayMove(entries, oldIndex, newIndex).map(
        (entry, idx) => ({
          ...entry,
          sortOrder: idx,
        }),
      )
      onEntriesChange(newOrder)
    }
  }

  const handleAddEntry = () => {
    const newEntry: LocalVerseteTineriEntry = {
      id: `temp-${Date.now()}`,
      personName: '',
      referenceInput: '',
      parsedResult: null,
      sortOrder: entries.length,
    }
    onEntriesChange([...entries, newEntry])
  }

  const handlePersonNameChange = useCallback(
    (entryId: string | number, personName: string) => {
      const updatedEntries = entries.map((entry) =>
        entry.id === entryId ? { ...entry, personName } : entry,
      )
      onEntriesChange(updatedEntries)
    },
    [entries, onEntriesChange],
  )

  const handleReferenceChange = useCallback(
    (
      entryId: string | number,
      referenceInput: string,
      parsed: ParsedPassageRange | null,
    ) => {
      const updatedEntries = entries.map((entry) =>
        entry.id === entryId
          ? { ...entry, referenceInput, parsedResult: parsed }
          : entry,
      )
      onEntriesChange(updatedEntries)
    },
    [entries, onEntriesChange],
  )

  const handleDeleteEntry = useCallback(
    (entryId: string | number) => {
      const newEntries = entries
        .filter((e) => e.id !== entryId)
        .map((entry, idx) => ({ ...entry, sortOrder: idx }))
      onEntriesChange(newEntries)
    },
    [entries, onEntriesChange],
  )

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <Users size={16} />
        <span>
          {t('verseteTineri.entriesCount', { count: entries.length })}
        </span>
      </div>

      {/* Entries list */}
      {entries.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={entries.map((e) => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {entries.map((entry, index) => (
                <VerseteTineriEntryRow
                  key={entry.id}
                  entry={entry}
                  index={index}
                  onPersonNameChange={(name) =>
                    handlePersonNameChange(entry.id, name)
                  }
                  onReferenceChange={(ref, parsed) =>
                    handleReferenceChange(entry.id, ref, parsed)
                  }
                  onDelete={() => handleDeleteEntry(entry.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          <Users className="w-8 h-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('verseteTineri.noEntries')}
          </p>
        </div>
      )}

      {/* Add entry button */}
      <button
        type="button"
        onClick={handleAddEntry}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-colors"
      >
        <Plus size={18} />
        {t('verseteTineri.addEntry')}
      </button>
    </div>
  )
}

export type { LocalVerseteTineriEntry }
