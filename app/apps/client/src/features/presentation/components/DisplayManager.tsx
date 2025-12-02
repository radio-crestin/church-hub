import { Loader2, MonitorUp, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '~/ui/toast/useToast'
import { DisplayCard } from './DisplayCard'
import { DisplayEditorModal } from './DisplayEditorModal'
import { DisplayThemeEditor } from './DisplayThemeEditor'
import {
  useDeleteDisplay,
  useDisplays,
  useUpdateDisplayTheme,
  useUpsertDisplay,
} from '../hooks'
import type { Display, DisplayTheme, UpsertDisplayInput } from '../types'

export function DisplayManager() {
  const { t } = useTranslation('presentation')
  const { showToast } = useToast()

  const { data: displays, isLoading } = useDisplays()
  const upsertDisplay = useUpsertDisplay()
  const deleteDisplay = useDeleteDisplay()
  const updateTheme = useUpdateDisplayTheme()

  const [editingDisplay, setEditingDisplay] = useState<Display | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [themeDisplay, setThemeDisplay] = useState<Display | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Display | null>(null)

  const handleAddNew = () => {
    setEditingDisplay(null)
    setIsEditorOpen(true)
  }

  const handleEdit = (display: Display) => {
    setEditingDisplay(display)
    setIsEditorOpen(true)
  }

  const handleSaveDisplay = async (input: UpsertDisplayInput) => {
    try {
      await upsertDisplay.mutateAsync(input)
      setIsEditorOpen(false)
      setEditingDisplay(null)
      showToast(t('messages.displaySaved'), 'success')
    } catch {
      showToast(t('messages.displaySaveFailed'), 'error')
    }
  }

  const handleToggleActive = async (display: Display) => {
    try {
      await upsertDisplay.mutateAsync({
        id: display.id,
        name: display.name,
        isActive: !display.isActive,
        openMode: display.openMode,
        theme: display.theme,
      })
      showToast(
        display.isActive
          ? t('messages.displayDeactivated')
          : t('messages.displayActivated'),
        'success',
      )
    } catch {
      showToast(t('messages.displayToggleFailed'), 'error')
    }
  }

  const handleTheme = (display: Display) => {
    setThemeDisplay(display)
  }

  const handleSaveTheme = async (theme: DisplayTheme) => {
    if (!themeDisplay) return

    try {
      await updateTheme.mutateAsync({ id: themeDisplay.id, theme })
      setThemeDisplay(null)
      showToast(t('messages.themeSaved'), 'success')
    } catch {
      showToast(t('messages.themeSaveFailed'), 'error')
    }
  }

  const handleDelete = (display: Display) => {
    setDeleteConfirm(display)
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return

    try {
      await deleteDisplay.mutateAsync(deleteConfirm.id)
      setDeleteConfirm(null)
      showToast(t('messages.displayDeleted'), 'success')
    } catch {
      showToast(t('messages.displayDeleteFailed'), 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MonitorUp size={24} className="text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('displays.title')}
          </h1>
        </div>
        <button
          type="button"
          onClick={handleAddNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={20} />
          {t('displays.add')}
        </button>
      </div>

      {/* Description */}
      <p className="text-gray-600 dark:text-gray-400">
        {t('displays.description')}
      </p>

      {/* Displays List */}
      {displays && displays.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displays.map((display) => (
            <DisplayCard
              key={display.id}
              display={display}
              onEdit={handleEdit}
              onTheme={handleTheme}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <MonitorUp
            size={48}
            className="mx-auto text-gray-400 dark:text-gray-500 mb-4"
          />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t('displays.empty')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {t('displays.emptyDescription')}
          </p>
          <button
            type="button"
            onClick={handleAddNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={20} />
            {t('displays.addFirst')}
          </button>
        </div>
      )}

      {/* Editor Modal */}
      <DisplayEditorModal
        display={editingDisplay}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false)
          setEditingDisplay(null)
        }}
        onSave={handleSaveDisplay}
        isSaving={upsertDisplay.isPending}
      />

      {/* Theme Editor */}
      {themeDisplay && (
        <DisplayThemeEditor
          display={themeDisplay}
          isOpen={!!themeDisplay}
          onClose={() => setThemeDisplay(null)}
          onSave={handleSaveTheme}
          isSaving={updateTheme.isPending}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t('displays.deleteConfirmTitle')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('displays.deleteConfirmMessage', { name: deleteConfirm.name })}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {t('actions.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteDisplay.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {deleteDisplay.isPending && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                {t('actions.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
