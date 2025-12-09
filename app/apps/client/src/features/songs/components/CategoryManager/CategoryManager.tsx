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
import { FolderOpen, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import { CategoryCard } from './CategoryCard'
import { CategoryForm } from './CategoryForm'
import {
  useCategories,
  useDeleteCategory,
  useReorderCategories,
  useUpsertCategory,
} from '../../hooks'
import type { SongCategory } from '../../types'

type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; category: SongCategory }
  | { type: 'delete'; category: SongCategory }

export function CategoryManager() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const { data: categories, isLoading, error } = useCategories()
  const upsertCategory = useUpsertCategory()
  const deleteCategory = useDeleteCategory()
  const reorderCategories = useReorderCategories()

  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [localCategories, setLocalCategories] = useState<SongCategory[]>([])

  // Sync local state when categories load
  useEffect(() => {
    if (categories) {
      setLocalCategories(categories)
    }
  }, [categories])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = localCategories.findIndex((c) => c.id === active.id)
      const newIndex = localCategories.findIndex((c) => c.id === over.id)

      const newOrder = arrayMove(localCategories, oldIndex, newIndex)
      setLocalCategories(newOrder)

      // Persist new order
      const result = await reorderCategories.mutateAsync(
        newOrder.map((c) => c.id),
      )
      if (!result.success) {
        showToast(t('sections.categories.toast.error'), 'error')
        // Revert on error
        setLocalCategories(categories ?? [])
      }
    }
  }

  const handleCreate = async (name: string) => {
    const result = await upsertCategory.mutateAsync({ name })
    if (result.success) {
      setModal({ type: 'none' })
      showToast(t('sections.categories.toast.created'), 'success')
    } else {
      showToast(t('sections.categories.toast.error'), 'error')
    }
  }

  const handleEdit = async (name: string) => {
    if (modal.type !== 'edit') return

    const result = await upsertCategory.mutateAsync({
      id: modal.category.id,
      name,
    })
    if (result.success) {
      setModal({ type: 'none' })
      showToast(t('sections.categories.toast.updated'), 'success')
    } else {
      showToast(t('sections.categories.toast.error'), 'error')
    }
  }

  const handleDelete = async () => {
    if (modal.type !== 'delete') return

    const success = await deleteCategory.mutateAsync(modal.category.id)
    if (success) {
      setModal({ type: 'none' })
      showToast(t('sections.categories.toast.deleted'), 'success')
    } else {
      showToast(t('sections.categories.toast.error'), 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        {t('sections.categories.toast.error')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('sections.categories.title')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('sections.categories.description')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ type: 'create' })}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700
            text-white rounded-lg transition-colors text-sm"
        >
          <Plus size={16} />
          {t('sections.categories.addCategory')}
        </button>
      </div>

      {localCategories.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localCategories.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {localCategories.map((category, index) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  index={index}
                  onEdit={() => setModal({ type: 'edit', category })}
                  onDelete={() => setModal({ type: 'delete', category })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="text-center py-12 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <FolderOpen
            size={48}
            className="mx-auto text-gray-400 dark:text-gray-500 mb-3"
          />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            {t('sections.categories.noCategories')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            {t('sections.categories.noCategoriesDescription')}
          </p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(modal.type === 'create' || modal.type === 'edit') && (
        <CategoryForm
          isOpen={true}
          category={modal.type === 'edit' ? modal.category : undefined}
          onSubmit={modal.type === 'create' ? handleCreate : handleEdit}
          onCancel={() => setModal({ type: 'none' })}
          isLoading={upsertCategory.isPending}
        />
      )}

      {/* Delete Confirmation */}
      {modal.type === 'delete' && (
        <ConfirmModal
          isOpen={true}
          title={t('sections.categories.modals.delete.title')}
          message={t('sections.categories.modals.delete.message', {
            name: modal.category.name,
          })}
          confirmLabel={t('sections.categories.modals.delete.confirm')}
          cancelLabel={t('common:buttons.cancel', 'Cancel')}
          onConfirm={handleDelete}
          onCancel={() => setModal({ type: 'none' })}
          variant="danger"
        />
      )}
    </div>
  )
}
