import { Plus, Search, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionHeader } from '~/ui/page'
import { UserCard } from './UserCard'
import { UserForm, type UserFormData } from './UserForm'
import { UserQRModal } from './UserQRModal'
import { ConfirmModal } from '../../../ui/modal/ConfirmModal'
import { ClearSearchButton } from '../../../ui/search'
import { useToast } from '../../../ui/toast'
import {
  useCreateUser,
  useDeleteUser,
  useRegenerateToken,
  useSetUserPassword,
  useUpdatePermissions,
  useUpdateUser,
  useUsers,
} from '../hooks'
import type { UserWithPermissions } from '../types'

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
  const setUserPassword = useSetUserPassword()
  const regenerateToken = useRegenerateToken()

  const [modal, setModal] = useState<ModalState>({ type: 'none' })
  const [search, setSearch] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Order: super admin first, then active users, then inactive — each group
  // sorted by name. A search box filters by name within that order.
  const visibleUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (users ?? [])
      .filter((u) => !q || u.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.isSuperAdmin !== b.isSuperAdmin) return a.isSuperAdmin ? -1 : 1
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }, [users, search])
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

  const handleCreate = async (data: UserFormData) => {
    try {
      const result = await createUser.mutateAsync({
        name: data.name,
        permissions: data.permissions,
        password: data.password || undefined,
      })
      setModal({ type: 'qr', user: result.user })
      showToast(t('sections.users.toast.created'), 'success')
    } catch {
      showToast(t('sections.users.toast.error'), 'error')
    }
  }

  const handleEdit = async (data: UserFormData) => {
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
      // Apply a password change only when intended (undefined = leave as-is).
      if (data.password !== undefined) {
        await setUserPassword.mutateAsync({
          id: modal.user.id,
          password: data.password,
        })
      }
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fg-label" />
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
      <SectionHeader
        title={t('sections.users.title')}
        description={t('sections.users.description')}
        actions={
          <button
            type="button"
            onClick={() => setModal({ type: 'create' })}
            className="flex items-center gap-2 h-8 px-3 font-medium bg-primary hover:bg-indigo-700
            text-white rounded-lg transition-colors text-sm"
          >
            <Plus strokeWidth={1.5} size={16} />
            {t('sections.users.addUser')}
          </button>
        }
      />

      {users && users.length > 0 && (
        <div className="relative">
          <Search
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-hint"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('sections.users.searchPlaceholder')}
            className={`h-9 w-full rounded-[10px] bg-field pl-9 text-sm text-fg placeholder:text-fg-hint outline-none focus:ring-1 focus:ring-inset focus:ring-focus ${
              search ? 'pr-9' : 'pr-3'
            }`}
          />
          {search && (
            <ClearSearchButton
              inputRef={searchInputRef}
              onClear={() => setSearch('')}
            />
          )}
        </div>
      )}

      {users && users.length > 0 ? (
        visibleUsers.length > 0 ? (
          <div className="grid gap-3">
            {visibleUsers.map((user) => (
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
          <p className="text-center py-8 text-sm text-fg-hint">
            {t('sections.users.noResults')}
          </p>
        )
      ) : (
        <div className="text-center py-12 border border-dashed border-line rounded-lg">
          <Users
            strokeWidth={1.5}
            size={48}
            className="mx-auto text-fg-hint mb-3"
          />
          <p className="text-fg-label font-medium">
            {t('sections.users.noUsers')}
          </p>
          <p className="text-sm text-fg-hint mt-1">
            {t('sections.users.noUsersDescription')}
          </p>
        </div>
      )}

      {/* Create/Edit Dialog — fixed header (title + close) and a sticky footer
          (provided by UserForm), with only the form body scrolling between.
          The flex layout lives on an INNER wrapper, never on the <dialog>
          itself: a `display:flex` on the element overrides the user-agent
          `display:none` of a closed dialog, which would leave it visible (and
          tiny) all the time. */}
      <dialog
        ref={formDialogRef}
        className="fixed inset-0 m-auto p-0 rounded-xl border border-line shadow-popover backdrop:bg-black/50 bg-panel max-w-2xl w-[calc(100%-2rem)] max-h-[90vh] overflow-hidden"
        onClose={() => setModal({ type: 'none' })}
        onClick={(e) => {
          if (e.target === formDialogRef.current) {
            setModal({ type: 'none' })
          }
        }}
      >
        <div className="flex max-h-[90vh] flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-6 py-4">
            <h2 className="text-base font-semibold text-fg">
              {modal.type === 'create'
                ? t('sections.users.modals.create.title')
                : t('sections.users.modals.edit.title')}
            </h2>
            <button
              type="button"
              onClick={() => setModal({ type: 'none' })}
              aria-label={t('sections.users.modals.cancel')}
              className="-mr-1.5 shrink-0 rounded-lg p-1.5 text-fg-hint transition-colors hover:bg-hover hover:text-fg-body"
            >
              <X strokeWidth={1.5} size={16} />
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
