import { Plus, Users, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { UserCard } from './UserCard'
import { UserForm } from './UserForm'
import { UserQRModal } from './UserQRModal'
import { ConfirmModal } from '../../../ui/modal/ConfirmModal'
import { useToast } from '../../../ui/toast'
import {
  useCreateUser,
  useDeleteUser,
  useRegenerateToken,
  useUpdatePermissions,
  useUpdateUser,
  useUsers,
} from '../hooks'
import type { Permission, UserWithPermissions } from '../types'

type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; user: UserWithPermissions }
  | { type: 'qr'; user: UserWithPermissions }
  | { type: 'delete'; user: UserWithPermissions }
  | { type: 'regenerate'; user: UserWithPermissions }

export function UserList() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const { data: users, isLoading, error } = useUsers()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const updatePermissions = useUpdatePermissions()
  const regenerateToken = useRegenerateToken()

  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const formDialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = formDialogRef.current
    if (!dialog) return

    if (modal.type === 'create' || modal.type === 'edit') {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [modal.type])

  const handleCreate = async (data: {
    name: string
    permissions: Permission[]
  }) => {
    try {
      const result = await createUser.mutateAsync(data)
      setModal({ type: 'qr', user: result.user })
      showToast(t('sections.users.toast.created'), 'success')
    } catch {
      showToast(t('sections.users.toast.error'), 'error')
    }
  }

  const handleEdit = async (data: {
    name: string
    permissions: Permission[]
  }) => {
    if (modal.type !== 'edit') return

    try {
      await updateUser.mutateAsync({
        id: modal.user.id,
        input: { name: data.name },
      })
      await updatePermissions.mutateAsync({
        id: modal.user.id,
        permissions: data.permissions,
      })
      setModal({ type: 'none' })
      showToast(t('sections.users.toast.updated'), 'success')
    } catch {
      showToast(t('sections.users.toast.error'), 'error')
    }
  }

  const handleDelete = async () => {
    if (modal.type !== 'delete') return

    try {
      await deleteUser.mutateAsync(modal.user.id)
      setModal({ type: 'none' })
      showToast(t('sections.users.toast.deleted'), 'success')
    } catch {
      showToast(t('sections.users.toast.error'), 'error')
    }
  }

  const handleRegenerateToken = async () => {
    if (modal.type !== 'regenerate') return

    try {
      const result = await regenerateToken.mutateAsync(modal.user.id)
      setModal({ type: 'qr', user: result.user })
      showToast(t('sections.users.toast.tokenRegenerated'), 'success')
    } catch {
      showToast(t('sections.users.toast.error'), 'error')
    }
  }

  const handleToggleActive = async (user: UserWithPermissions) => {
    try {
      await updateUser.mutateAsync({
        id: user.id,
        input: { isActive: !user.isActive },
      })
      showToast(t('sections.users.toast.updated'), 'success')
    } catch {
      showToast(t('sections.users.toast.error'), 'error')
    }
  }

  const handleShowQR = (user: UserWithPermissions) => {
    // Token is now stored in the database, so we can show QR directly
    setModal({ type: 'qr', user })
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
        {t('sections.users.toast.error')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t('sections.users.title')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('sections.users.description')}
          </p>
        </div>
        <button
          onClick={() => setModal({ type: 'create' })}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700
            text-white rounded-lg transition-colors text-sm"
        >
          <Plus size={16} />
          {t('sections.users.addUser')}
        </button>
      </div>

      {users && users.length > 0 ? (
        <div className="grid gap-3">
          {users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              onEdit={(u) => setModal({ type: 'edit', user: u })}
              onDelete={(u) => setModal({ type: 'delete', user: u })}
              onShowQR={handleShowQR}
              onRegenerateToken={(u) =>
                setModal({ type: 'regenerate', user: u })
              }
              onToggleActive={handleToggleActive}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <Users
            size={48}
            className="mx-auto text-gray-400 dark:text-gray-500 mb-3"
          />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            {t('sections.users.noUsers')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            {t('sections.users.noUsersDescription')}
          </p>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <dialog
        ref={formDialogRef}
        className="fixed inset-0 m-auto p-0 rounded-lg shadow-xl backdrop:bg-black/50 bg-white dark:bg-gray-800 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClose={() => setModal({ type: 'none' })}
        onClick={(e) => {
          if (e.target === formDialogRef.current) {
            setModal({ type: 'none' })
          }
        }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {modal.type === 'create'
                ? t('sections.users.modals.create.title')
                : t('sections.users.modals.edit.title')}
            </h2>
            <button
              onClick={() => setModal({ type: 'none' })}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>
          <UserForm
            key={modal.type === 'edit' ? modal.user.id : 'create'}
            user={modal.type === 'edit' ? modal.user : undefined}
            onSubmit={modal.type === 'create' ? handleCreate : handleEdit}
            onCancel={() => setModal({ type: 'none' })}
            isLoading={createUser.isPending || updateUser.isPending}
          />
        </div>
      </dialog>

      {/* QR Code Modal */}
      {modal.type === 'qr' && (
        <UserQRModal
          isOpen={true}
          userName={modal.user.name}
          token={modal.user.token}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {/* Delete Confirmation */}
      {modal.type === 'delete' && (
        <ConfirmModal
          isOpen={true}
          title={t('sections.users.modals.delete.title')}
          message={t('sections.users.modals.delete.message', {
            name: modal.user.name,
          })}
          confirmLabel={t('sections.users.modals.delete.confirm')}
          cancelLabel={t('sections.users.modals.cancel')}
          onConfirm={handleDelete}
          onCancel={() => setModal({ type: 'none' })}
          variant="danger"
        />
      )}

      {/* Regenerate Token Confirmation */}
      {modal.type === 'regenerate' && (
        <ConfirmModal
          isOpen={true}
          title={t('sections.users.modals.regenerate.title')}
          message={t('sections.users.modals.regenerate.message', {
            name: modal.user.name,
          })}
          confirmLabel={t('sections.users.modals.regenerate.confirm')}
          cancelLabel={t('sections.users.modals.cancel')}
          onConfirm={handleRegenerateToken}
          onCancel={() => setModal({ type: 'none' })}
        />
      )}
    </div>
  )
}
