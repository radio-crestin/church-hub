import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Download,
  FileText,
  ListPlus,
  Loader2,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSaveScheduleToFile } from '~/features/schedule-export'
import { SongPickerModal } from '~/features/songs/components'
import { useToast } from '~/ui/toast'
import { AddToScheduleMenu } from './AddToScheduleMenu'
import { EditAsTextModal } from './EditAsTextModal'
import { InsertSlideModal } from './InsertSlideModal'
import { ScheduleItemList } from './ScheduleItemList'
import {
  useAddItemToSchedule,
  useDeleteSchedule,
  useImportScheduleToQueue,
  useRemoveItemFromSchedule,
  useReorderScheduleItems,
  useSchedule,
  useUpsertSchedule,
} from '../hooks'
import type { ScheduleItem, SlideTemplate } from '../types'

interface ScheduleEditorProps {
  scheduleId: number | null
  onBack: () => void
  onDeleted?: () => void
  onScheduleCreated?: (newId: number) => void
}

export function ScheduleEditor({
  scheduleId,
  onBack,
  onDeleted,
  onScheduleCreated,
}: ScheduleEditorProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()
  const navigate = useNavigate()

  const {
    data: schedule,
    isLoading,
    refetch,
  } = useSchedule(scheduleId ?? undefined)
  const upsertSchedule = useUpsertSchedule()
  const deleteSchedule = useDeleteSchedule()
  const addItem = useAddItemToSchedule()
  const importToQueue = useImportScheduleToQueue()
  const reorderItems = useReorderScheduleItems()
  const removeItem = useRemoveItemFromSchedule()
  const { saveSchedule, isPending: isSaving } = useSaveScheduleToFile()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [localItems, setLocalItems] = useState<ScheduleItem[]>([])
  const [showSongPicker, setShowSongPicker] = useState(false)
  const [showSlideModal, setShowSlideModal] = useState(false)
  const [slideTemplate, setSlideTemplate] =
    useState<SlideTemplate>('announcement')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEditAsText, setShowEditAsText] = useState(false)
  // Track created schedule ID for auto-save flow
  const [createdScheduleId, setCreatedScheduleId] = useState<number | null>(
    null,
  )

  // Effective schedule ID (either prop or newly created)
  const effectiveScheduleId = scheduleId ?? createdScheduleId

  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Load schedule data
  useEffect(() => {
    if (schedule) {
      setTitle(schedule.title)
      setDescription(schedule.description ?? '')
      setLocalItems(schedule.items ?? [])
    } else if (scheduleId === null) {
      // New schedule
      setTitle('')
      setDescription('')
      setLocalItems([])
      titleInputRef.current?.focus()
    }
  }, [schedule, scheduleId])

  // Delete dialog handling
  useEffect(() => {
    if (showDeleteConfirm) {
      deleteDialogRef.current?.showModal()
    } else {
      deleteDialogRef.current?.close()
    }
  }, [showDeleteConfirm])

  const handleTitleChange = (value: string) => {
    setTitle(value)
  }

  const handleDescriptionChange = (value: string) => {
    setDescription(value)
  }

  const handleSave = useCallback(
    async (
      currentTitle: string,
      currentDescription: string,
    ): Promise<number | null> => {
      if (!currentTitle.trim()) {
        return null
      }

      const result = await upsertSchedule.mutateAsync({
        id: effectiveScheduleId ?? undefined,
        title: currentTitle.trim(),
        description: currentDescription.trim() || null,
      })

      if (result.success && result.data) {
        const savedScheduleId = result.data.id

        // If this was a new schedule, track the ID
        if (scheduleId === null && savedScheduleId) {
          setCreatedScheduleId(savedScheduleId)
          onScheduleCreated?.(savedScheduleId)
        }
        return savedScheduleId
      }
      return null
    },
    [effectiveScheduleId, scheduleId, upsertSchedule, onScheduleCreated],
  )

  // Auto-save title/description with debounce
  useEffect(() => {
    // Skip auto-save if no title yet
    if (!title.trim()) return

    const timeoutId = setTimeout(() => {
      handleSave(title, description)
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [title, description, handleSave])

  const handleDelete = async () => {
    if (!effectiveScheduleId) return

    const result = await deleteSchedule.mutateAsync(effectiveScheduleId)
    if (result.success) {
      showToast(t('messages.deleted'), 'success')
      setShowDeleteConfirm(false)
      onDeleted?.()
      onBack()
    } else {
      showToast(t('messages.error'), 'error')
    }
  }

  // Helper to ensure we have a schedule ID (auto-save if new)
  const ensureScheduleId = async (): Promise<number | null> => {
    if (effectiveScheduleId !== null) return effectiveScheduleId
    // Auto-save the schedule first
    return await handleSave(title, description)
  }

  const handleAddSong = async () => {
    const id = await ensureScheduleId()
    if (id !== null) {
      setShowSongPicker(true)
    }
  }

  const handleAddSlide = async (template: SlideTemplate) => {
    const id = await ensureScheduleId()
    if (id !== null) {
      setSlideTemplate(template)
      setShowSlideModal(true)
    }
  }

  const handleSongSelected = async (songId: number) => {
    const id = effectiveScheduleId
    if (!id) return

    const result = await addItem.mutateAsync({
      scheduleId: id,
      input: { songId },
    })

    if (result.success) {
      showToast(t('messages.itemAdded'), 'success')
    }
  }

  // Item handlers - save directly to server
  const handleReorderItems = async (oldIndex: number, newIndex: number) => {
    if (!effectiveScheduleId) return

    // Update local state immediately for responsive UI
    const newItems = [...localItems]
    const [removed] = newItems.splice(oldIndex, 1)
    newItems.splice(newIndex, 0, removed)
    setLocalItems(newItems)

    // Persist to server
    await reorderItems.mutateAsync({
      scheduleId: effectiveScheduleId,
      input: { itemIds: newItems.map((item) => item.id) },
    })
  }

  const handleRemoveItem = async (itemId: number) => {
    if (!effectiveScheduleId) return

    // Update local state immediately for responsive UI
    setLocalItems((prev) => prev.filter((item) => item.id !== itemId))

    // Persist to server
    await removeItem.mutateAsync({
      scheduleId: effectiveScheduleId,
      itemId,
    })
  }

  const handleImportToQueue = async () => {
    if (!effectiveScheduleId) return

    const success = await importToQueue.mutateAsync(effectiveScheduleId)
    if (success) {
      showToast(t('messages.importedToQueue'), 'success')
      navigate({ to: '/present' })
    } else {
      showToast(t('messages.error'), 'error')
    }
  }

  const handleSaveToFile = useCallback(async () => {
    if (!schedule) return
    const result = await saveSchedule(schedule)
    if (result.success) {
      showToast(t('messages.savedToFile'), 'success')
    } else if (result.error) {
      showToast(result.error, 'error')
    }
  }, [schedule, saveSchedule, showToast, t])

  if (isLoading && scheduleId !== null) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 rounded-lg transition-colors"
        >
          <ArrowLeft size={16} />
          {t('actions.back')}
        </button>

        <div className="flex items-center gap-2">
          {effectiveScheduleId !== null && (
            <>
              <button
                type="button"
                onClick={handleSaveToFile}
                disabled={isSaving}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                {t('actions.saveToFile')}
              </button>
              <button
                type="button"
                onClick={() => setShowEditAsText(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 rounded-lg transition-colors"
              >
                <FileText size={16} />
                {t('actions.editAsText')}
              </button>
              <button
                type="button"
                onClick={handleImportToQueue}
                disabled={importToQueue.isPending}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {importToQueue.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ListPlus size={16} />
                )}
                {t('actions.importToQueue')}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Title & Description */}
      <div className="space-y-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder={t('editor.titlePlaceholder')}
          className="w-full px-0 py-1 text-xl font-semibold bg-transparent border-0 border-b-2 border-transparent focus:border-indigo-500 focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400 transition-colors"
        />
        <textarea
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder={t('editor.descriptionPlaceholder')}
          rows={2}
          className="w-full px-0 py-1 bg-transparent border-0 resize-none focus:ring-0 text-gray-600 dark:text-gray-400 placeholder-gray-400"
        />
      </div>

      {/* Items Section */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('editor.items')}
          </h3>
          <AddToScheduleMenu
            onAddSong={handleAddSong}
            onAddSlide={handleAddSlide}
          />
        </div>

        {effectiveScheduleId !== null ? (
          <ScheduleItemList
            scheduleId={effectiveScheduleId}
            items={localItems}
            isLoading={isLoading}
            onReorder={handleReorderItems}
            onRemoveItem={handleRemoveItem}
          />
        ) : (
          <div className="text-center py-8 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">
              {t('editor.noItems')}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {t('editor.addFirstItem')}
            </p>
          </div>
        )}
      </div>

      {/* Song Picker Modal */}
      <SongPickerModal
        isOpen={showSongPicker}
        onClose={() => setShowSongPicker(false)}
        onSongSelect={handleSongSelected}
        hideAddToQueue
      />

      {/* Insert Slide Modal */}
      {effectiveScheduleId !== null && (
        <InsertSlideModal
          isOpen={showSlideModal}
          onClose={() => setShowSlideModal(false)}
          scheduleId={effectiveScheduleId}
          initialTemplate={slideTemplate}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <dialog
        ref={deleteDialogRef}
        onCancel={() => setShowDeleteConfirm(false)}
        onClick={(e) => {
          if (e.target === deleteDialogRef.current) setShowDeleteConfirm(false)
        }}
        className="fixed inset-0 m-auto w-full max-w-sm p-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl backdrop:bg-black/50"
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t('modal.deleteTitle')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('modal.deleteMessage')}
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex items-center gap-2 px-4 py-2 text-white bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              <X size={16} />
              {t('actions.cancel', { ns: 'common' })}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteSchedule.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deleteSchedule.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
              {t('actions.delete')}
            </button>
          </div>
        </div>
      </dialog>

      {/* Edit as Text Modal */}
      <EditAsTextModal
        isOpen={showEditAsText}
        onClose={() => setShowEditAsText(false)}
        scheduleId={effectiveScheduleId}
        currentItems={localItems}
        onItemsUpdated={() => {
          refetch()
        }}
      />
    </div>
  )
}
