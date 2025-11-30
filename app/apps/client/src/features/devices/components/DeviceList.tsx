import { Plus, Smartphone, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DeviceCard } from './DeviceCard'
import { DeviceForm } from './DeviceForm'
import { DeviceQRModal } from './DeviceQRModal'
import { ConfirmModal } from '../../../ui/modal/ConfirmModal'
import { useToast } from '../../../ui/toast'
import {
  useCreateDevice,
  useDeleteDevice,
  useDevices,
  useRegenerateToken,
  useUpdateDevice,
  useUpdatePermissions,
} from '../hooks'
import type { DevicePermissions, DeviceWithPermissions } from '../types'

type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; device: DeviceWithPermissions }
  | { type: 'qr'; device: DeviceWithPermissions; token: string }
  | { type: 'delete'; device: DeviceWithPermissions }
  | { type: 'regenerate'; device: DeviceWithPermissions }

export function DeviceList() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const { data: devices, isLoading, error } = useDevices()
  const createDevice = useCreateDevice()
  const updateDevice = useUpdateDevice()
  const deleteDevice = useDeleteDevice()
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
    permissions: DevicePermissions
  }) => {
    try {
      const result = await createDevice.mutateAsync(data)
      setModal({ type: 'qr', device: result.device, token: result.token })
      showToast(t('sections.devices.toast.created'), 'success')
    } catch {
      showToast(t('sections.devices.toast.error'), 'error')
    }
  }

  const handleEdit = async (data: {
    name: string
    permissions: DevicePermissions
  }) => {
    if (modal.type !== 'edit') return

    try {
      await updateDevice.mutateAsync({
        id: modal.device.id,
        input: { name: data.name },
      })
      await updatePermissions.mutateAsync({
        id: modal.device.id,
        permissions: data.permissions,
      })
      setModal({ type: 'none' })
      showToast(t('sections.devices.toast.updated'), 'success')
    } catch {
      showToast(t('sections.devices.toast.error'), 'error')
    }
  }

  const handleDelete = async () => {
    if (modal.type !== 'delete') return

    try {
      await deleteDevice.mutateAsync(modal.device.id)
      setModal({ type: 'none' })
      showToast(t('sections.devices.toast.deleted'), 'success')
    } catch {
      showToast(t('sections.devices.toast.error'), 'error')
    }
  }

  const handleRegenerateToken = async () => {
    if (modal.type !== 'regenerate') return

    try {
      const result = await regenerateToken.mutateAsync(modal.device.id)
      setModal({ type: 'qr', device: result.device, token: result.token })
      showToast(t('sections.devices.toast.tokenRegenerated'), 'success')
    } catch {
      showToast(t('sections.devices.toast.error'), 'error')
    }
  }

  const handleToggleActive = async (device: DeviceWithPermissions) => {
    try {
      await updateDevice.mutateAsync({
        id: device.id,
        input: { isActive: !device.isActive },
      })
      showToast(t('sections.devices.toast.updated'), 'success')
    } catch {
      showToast(t('sections.devices.toast.error'), 'error')
    }
  }

  const handleShowQR = (device: DeviceWithPermissions) => {
    // We need to regenerate to get the token since we don't store it
    setModal({ type: 'regenerate', device })
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
        {t('sections.devices.toast.error')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t('sections.devices.title')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('sections.devices.description')}
          </p>
        </div>
        <button
          onClick={() => setModal({ type: 'create' })}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700
            text-white rounded-lg transition-colors text-sm"
        >
          <Plus size={16} />
          {t('sections.devices.addDevice')}
        </button>
      </div>

      {devices && devices.length > 0 ? (
        <div className="grid gap-3">
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onEdit={(d) => setModal({ type: 'edit', device: d })}
              onDelete={(d) => setModal({ type: 'delete', device: d })}
              onShowQR={handleShowQR}
              onRegenerateToken={(d) =>
                setModal({ type: 'regenerate', device: d })
              }
              onToggleActive={handleToggleActive}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <Smartphone
            size={48}
            className="mx-auto text-gray-400 dark:text-gray-500 mb-3"
          />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            {t('sections.devices.noDevices')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
            {t('sections.devices.noDevicesDescription')}
          </p>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <dialog
        ref={formDialogRef}
        className="fixed inset-0 m-auto p-0 rounded-lg shadow-xl backdrop:bg-black/50 bg-white dark:bg-gray-800 max-w-lg w-full"
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
                ? t('sections.devices.modals.create.title')
                : t('sections.devices.modals.edit.title')}
            </h2>
            <button
              onClick={() => setModal({ type: 'none' })}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>
          <DeviceForm
            device={modal.type === 'edit' ? modal.device : undefined}
            onSubmit={modal.type === 'create' ? handleCreate : handleEdit}
            onCancel={() => setModal({ type: 'none' })}
            isLoading={createDevice.isPending || updateDevice.isPending}
          />
        </div>
      </dialog>

      {/* QR Code Modal */}
      {modal.type === 'qr' && (
        <DeviceQRModal
          isOpen={true}
          deviceName={modal.device.name}
          token={modal.token}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {/* Delete Confirmation */}
      {modal.type === 'delete' && (
        <ConfirmModal
          isOpen={true}
          title={t('sections.devices.modals.delete.title')}
          message={t('sections.devices.modals.delete.message', {
            name: modal.device.name,
          })}
          confirmLabel={t('sections.devices.modals.delete.confirm')}
          cancelLabel={t('sections.devices.modals.delete.cancel')}
          onConfirm={handleDelete}
          onCancel={() => setModal({ type: 'none' })}
          variant="danger"
        />
      )}

      {/* Regenerate Token Confirmation */}
      {modal.type === 'regenerate' && (
        <ConfirmModal
          isOpen={true}
          title={t('sections.devices.modals.regenerate.title')}
          message={t('sections.devices.modals.regenerate.message', {
            name: modal.device.name,
          })}
          confirmLabel={t('sections.devices.modals.regenerate.confirm')}
          cancelLabel={t('sections.devices.modals.regenerate.cancel')}
          onConfirm={handleRegenerateToken}
          onCancel={() => setModal({ type: 'none' })}
        />
      )}
    </div>
  )
}
