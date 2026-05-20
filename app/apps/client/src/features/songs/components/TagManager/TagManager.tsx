import { Plus, Tags } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import { TagCard } from './TagCard'
import { TagForm } from './TagForm'
import { useDeleteTag, useTags, useUpsertTag } from '../../hooks'
import type { SongTag } from '../../types'

type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; tag: SongTag }
  | { type: 'delete'; tag: SongTag }

export function TagManager() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const { data: tags, isLoading, error } = useTags()
  const upsertTag = useUpsertTag()
  const deleteTag = useDeleteTag()

  const [modal, setModal] = useState<ModalState>({ type: 'none' })

  const handleCreate = async (name: string) => {
    const result = await upsertTag.mutateAsync({ name })
    if (result.success) {
      setModal({ type: 'none' })
      showToast(t('sections.tags.toast.created'), 'success')
    } else {
      showToast(result.error || t('sections.tags.toast.error'), 'error')
    }
  }

  const handleEdit = async (name: string) => {
    if (modal.type !== 'edit') return
    const result = await upsertTag.mutateAsync({
      id: modal.tag.id,
      name,
    })
    if (result.success) {
      setModal({ type: 'none' })
      showToast(t('sections.tags.toast.updated'), 'success')
    } else {
      showToast(result.error || t('sections.tags.toast.error'), 'error')
    }
  }

  const handleDelete = async () => {
    if (modal.type !== 'delete') return
    const success = await deleteTag.mutateAsync(modal.tag.id)
    if (success) {
      setModal({ type: 'none' })
      showToast(t('sections.tags.toast.deleted'), 'success')
    } else {
      showToast(t('sections.tags.toast.error'), 'error')
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
        {t('sections.tags.toast.error')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('sections.tags.title')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('sections.tags.description')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ type: 'create' })}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm whitespace-nowrap shrink-0"
        >
          <Plus size={16} />
          {t('sections.tags.addTag')}
        </button>
      </div>

      {tags && tags.length > 0 ? (
        <div className="space-y-2">
          {tags.map((tag) => (
            <TagCard
              key={tag.id}
              tag={tag}
              onEdit={() => setModal({ type: 'edit', tag })}
              onDelete={() => setModal({ type: 'delete', tag })}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <Tags
            size={48}
            className="mx-auto text-gray-400 dark:text-gray-500 mb-3"
          />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            {t('sections.tags.noTags')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            {t('sections.tags.noTagsDescription')}
          </p>
        </div>
      )}

      {(modal.type === 'create' || modal.type === 'edit') && (
        <TagForm
          isOpen={true}
          tag={modal.type === 'edit' ? modal.tag : undefined}
          onSubmit={modal.type === 'create' ? handleCreate : handleEdit}
          onCancel={() => setModal({ type: 'none' })}
          isLoading={upsertTag.isPending}
        />
      )}

      {modal.type === 'delete' && (
        <ConfirmModal
          isOpen={true}
          title={t('sections.tags.modals.delete.title')}
          message={t('sections.tags.modals.delete.message', {
            name: modal.tag.name,
          })}
          confirmLabel={t('sections.tags.modals.delete.confirm')}
          cancelLabel={t('common:buttons.cancel', 'Cancel')}
          onConfirm={handleDelete}
          onCancel={() => setModal({ type: 'none' })}
          variant="danger"
        />
      )}
    </div>
  )
}
