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
import { Book, Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast'
import { AddTranslationModal } from './AddTranslationModal'
import { TranslationItemCard } from './TranslationItemCard'
import {
  MAX_TRANSLATIONS,
  useSelectedBibleTranslations,
} from '../hooks/useSelectedBibleTranslations'

export function BibleTranslationsManager() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()

  const {
    selectedTranslations,
    selectedIds,
    availableTranslations,
    addTranslation,
    removeTranslation,
    reorderTranslations,
    isLoading,
    canAddMore,
  } = useSelectedBibleTranslations()

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = selectedIds.findIndex((id) => id === active.id)
    const newIndex = selectedIds.findIndex((id) => id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    const newOrder = arrayMove(selectedIds, oldIndex, newIndex)

    try {
      await reorderTranslations(newOrder)
      showToast(t('sections.bible.toast.saved'), 'success')
    } catch {
      showToast(t('sections.bible.toast.error'), 'error')
    }
  }

  const handleAddTranslation = async (translationId: number) => {
    try {
      await addTranslation(translationId)
      showToast(t('sections.bible.toast.added'), 'success')
    } catch {
      showToast(t('sections.bible.toast.error'), 'error')
    }
  }

  const handleRemoveTranslation = async (translationId: number) => {
    try {
      await removeTranslation(translationId)
      showToast(t('sections.bible.toast.removed'), 'success')
    } catch {
      showToast(t('sections.bible.toast.error'), 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Book className="w-5 h-5" />
            {t('sections.bible.title')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('sections.bible.description')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          disabled={!canAddMore}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          title={!canAddMore ? t('sections.bible.maxReached') : undefined}
        >
          <Plus size={16} />
          {t('sections.bible.addTranslation')}
        </button>
      </div>

      {/* Translation List */}
      {selectedTranslations.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
          <Book className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            {t('sections.bible.noTranslations')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            {t('sections.bible.noTranslationsDescription')}
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={selectedIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {selectedTranslations.map((translation, index) => (
                <TranslationItemCard
                  key={translation.id}
                  translation={translation}
                  index={index}
                  onRemove={() => handleRemoveTranslation(translation.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Max translations info */}
      {selectedTranslations.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          {selectedTranslations.length} / {MAX_TRANSLATIONS}{' '}
          {t('sections.bible.translationsSelected', {
            defaultValue: 'translations selected',
          })}
        </p>
      )}

      {/* Add Translation Modal */}
      <AddTranslationModal
        isOpen={isAddModalOpen}
        availableTranslations={availableTranslations}
        onSubmit={handleAddTranslation}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  )
}
