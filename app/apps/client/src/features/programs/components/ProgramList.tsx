import { Link, useNavigate } from '@tanstack/react-router'
import { FileQuestion, Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useStartPresentation } from '~/features/presentation/hooks'
import { ConfirmModal } from '~/ui/modal/ConfirmModal'
import { useToast } from '~/ui/toast/useToast'
import { ProgramCard } from './ProgramCard'
import { useDeleteProgram, usePrograms } from '../hooks'
import type { Program } from '../types'

export function ProgramList() {
  const { t } = useTranslation('programs')
  const navigate = useNavigate()
  const { data: programs, isLoading, error } = usePrograms()
  const deleteProgram = useDeleteProgram()
  const startPresentation = useStartPresentation()
  const { showToast } = useToast()
  const [programToDelete, setProgramToDelete] = useState<Program | null>(null)

  const handlePresent = async (program: Program) => {
    try {
      await startPresentation.mutateAsync(program.id)
      navigate({ to: '/present' })
    } catch {
      showToast(t('messages.presentFailed'), 'error')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!programToDelete) return

    try {
      await deleteProgram.mutateAsync(programToDelete.id)
      showToast(t('messages.deleted'), 'success')
    } catch {
      showToast(t('messages.deleteFailed'), 'error')
    } finally {
      setProgramToDelete(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        {t('messages.loadError')}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('title')}
        </h1>
        <Link
          to="/programs/$programId"
          params={{ programId: 'new' }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={20} />
          {t('actions.create')}
        </Link>
      </div>

      {programs && programs.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              onDelete={setProgramToDelete}
              onPresent={handlePresent}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          <FileQuestion className="w-12 h-12 text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {t('messages.empty')}
          </p>
          <Link
            to="/programs/$programId"
            params={{ programId: 'new' }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={20} />
            {t('actions.createFirst')}
          </Link>
        </div>
      )}

      <ConfirmModal
        isOpen={!!programToDelete}
        onClose={() => setProgramToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title={t('deleteModal.title')}
        message={t('deleteModal.message', { name: programToDelete?.name })}
        confirmText={t('deleteModal.confirm')}
        cancelText={t('deleteModal.cancel')}
        isLoading={deleteProgram.isPending}
        variant="danger"
      />
    </div>
  )
}
