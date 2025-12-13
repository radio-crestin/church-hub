import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { SynonymGroup } from '~/service/synonyms'
import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import { SynonymCard } from './SynonymCard'
import { SynonymForm } from './SynonymForm'
import { useDeleteSynonym, useSynonyms, useUpsertSynonym } from '../../hooks'

type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; synonym: SynonymGroup }
  | { type: 'delete'; synonym: SynonymGroup }

export function SynonymManager() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const { data: synonyms, isLoading, error } = useSynonyms()
  const upsertSynonym = useUpsertSynonym()
  const deleteSynonym = useDeleteSynonym()

  const [modal, setModal] = useState<ModalState>({ type: 'none' })

  const handleCreate = async (primary: string, synonymsList: string[]) => {
    const success = await upsertSynonym.mutateAsync({
      primary,
      synonyms: synonymsList,
    })
    if (success) {
      setModal({ type: 'none' })
      showToast(t('sections.synonyms.toast.created'), 'success')
    } else {
      showToast(t('sections.synonyms.toast.error'), 'error')
    }
  }

  const handleEdit = async (primary: string, synonymsList: string[]) => {
    if (modal.type !== 'edit') return

    const success = await upsertSynonym.mutateAsync({
      id: modal.synonym.id,
      primary,
      synonyms: synonymsList,
    })
    if (success) {
      setModal({ type: 'none' })
      showToast(t('sections.synonyms.toast.updated'), 'success')
    } else {
      showToast(t('sections.synonyms.toast.error'), 'error')
    }
  }

  const handleDelete = async () => {
    if (modal.type !== 'delete') return

    const success = await deleteSynonym.mutateAsync(modal.synonym.id)
    if (success) {
      setModal({ type: 'none' })
      showToast(t('sections.synonyms.toast.deleted'), 'success')
    } else {
      showToast(t('sections.synonyms.toast.error'), 'error')
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
        {t('sections.synonyms.toast.error')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('sections.synonyms.title')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('sections.synonyms.description')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ type: 'create' })}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700
            text-white rounded-lg transition-colors text-sm"
        >
          <Plus size={16} />
          {t('sections.synonyms.addSynonym')}
        </button>
      </div>

      {synonyms && synonyms.length > 0 ? (
        <div className="space-y-2">
          {synonyms.map((synonym) => (
            <SynonymCard
              key={synonym.id}
              synonym={synonym}
              onEdit={() => setModal({ type: 'edit', synonym })}
              onDelete={() => setModal({ type: 'delete', synonym })}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <Search
            size={48}
            className="mx-auto text-gray-400 dark:text-gray-500 mb-3"
          />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            {t('sections.synonyms.noSynonyms')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            {t('sections.synonyms.noSynonymsDescription')}
          </p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(modal.type === 'create' || modal.type === 'edit') && (
        <SynonymForm
          isOpen={true}
          synonym={modal.type === 'edit' ? modal.synonym : undefined}
          onSubmit={modal.type === 'create' ? handleCreate : handleEdit}
          onCancel={() => setModal({ type: 'none' })}
          isLoading={upsertSynonym.isPending}
        />
      )}

      {/* Delete Confirmation */}
      {modal.type === 'delete' && (
        <ConfirmModal
          isOpen={true}
          title={t('sections.synonyms.modals.delete.title')}
          message={t('sections.synonyms.modals.delete.message', {
            primary: modal.synonym.primary,
          })}
          confirmLabel={t('sections.synonyms.modals.delete.confirm')}
          cancelLabel={t('common:buttons.cancel', 'Cancel')}
          onConfirm={handleDelete}
          onCancel={() => setModal({ type: 'none' })}
          variant="danger"
        />
      )}
    </div>
  )
}
