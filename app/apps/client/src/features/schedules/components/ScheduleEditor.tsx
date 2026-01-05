import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  type ChurchProgramData,
  type ScheduleExportFormat,
  ScheduleExportFormatModal,
  useImportScheduleItems,
  useLoadScheduleFromFile,
  useSaveScheduleToFile,
} from '~/features/schedule-export'
import { SongPickerModal } from '~/features/songs/components'
import { useToast } from '~/ui/toast'
import { Tooltip } from '~/ui/tooltip/Tooltip'
import { AddToScheduleMenu } from './AddToScheduleMenu'
import { BiblePassagePickerModal } from './BiblePassagePickerModal'
import { EditAsTextModal } from './EditAsTextModal'
import { InsertSlideModal } from './InsertSlideModal'
import { ScheduleItemList } from './ScheduleItemList'
import {
  useAddItemToSchedule,
  useDeleteSchedule,
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

  const {
    data: schedule,
    isLoading,
    refetch,
  } = useSchedule(scheduleId ?? undefined)
  const upsertSchedule = useUpsertSchedule()
  const deleteSchedule = useDeleteSchedule()
  const addItem = useAddItemToSchedule()
  const reorderItems = useReorderScheduleItems()
  const removeItem = useRemoveItemFromSchedule()
  const { saveSchedule, isPending: isSaving } = useSaveScheduleToFile()
  const { loadSchedule, isPending: isLoadingFile } = useLoadScheduleFromFile()
  const { importItems, isPending: isImporting } = useImportScheduleItems()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [localItems, setLocalItems] = useState<ScheduleItem[]>([])
  const [showSongPicker, setShowSongPicker] = useState(false)
  const [showSlideModal, setShowSlideModal] = useState(false)
  const [slideTemplate, setSlideTemplate] =
    useState<SlideTemplate>('announcement')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEditAsText, setShowEditAsText] = useState(false)
  const [showBiblePassagePicker, setShowBiblePassagePicker] = useState(false)
  const [showExportFormatModal, setShowExportFormatModal] = useState(false)
  const [showImportConfirmModal, setShowImportConfirmModal] = useState(false)
  const [importData, setImportData] = useState<ChurchProgramData | null>(null)
  // Track created schedule ID for auto-save flow
  const [createdScheduleId, setCreatedScheduleId] = useState<number | null>(
    null,
  )

  // Effective schedule ID (either prop or newly created)
  const effectiveScheduleId = scheduleId ?? createdScheduleId

  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const importDialogRef = useRef<HTMLDialogElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Track last saved values to detect actual changes
  const lastSavedRef = useRef({ title: '', description: '' })
  // Track if there are unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Load schedule data
  useEffect(() => {
    if (schedule) {
      setTitle(schedule.title)
      setDescription(schedule.description ?? '')
      setLocalItems(schedule.items ?? [])
      // Update last saved values when loading from server
      lastSavedRef.current = {
        title: schedule.title,
        description: schedule.description ?? '',
      }
      setHasUnsavedChanges(false)
    } else if (scheduleId === null) {
      // New schedule
      setTitle('')
      setDescription('')
      setLocalItems([])
      lastSavedRef.current = { title: '', description: '' }
      setHasUnsavedChanges(false)
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

  // Import dialog handling
  useEffect(() => {
    if (showImportConfirmModal) {
      importDialogRef.current?.showModal()
    } else {
      importDialogRef.current?.close()
    }
  }, [showImportConfirmModal])

  const handleTitleChange = (value: string) => {
    setTitle(value)
    setHasUnsavedChanges(true)
  }

  const handleDescriptionChange = (value: string) => {
    setDescription(value)
    setHasUnsavedChanges(true)
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

        // Update last saved values
        lastSavedRef.current = {
          title: currentTitle.trim(),
          description: currentDescription.trim(),
        }
        setHasUnsavedChanges(false)

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

  // Manual save handler for the save button
  const handleManualSave = async () => {
    if (!title.trim()) {
      showToast(t('messages.titleRequired', 'Title is required'), 'error')
      return
    }
    await handleSave(title, description)
    showToast(t('messages.saved', 'Saved'), 'success')
  }

  const handleDelete = async () => {
    if (!effectiveScheduleId) return

    const success = await deleteSchedule.mutateAsync(effectiveScheduleId)
    if (success) {
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

  const handleAddBiblePassage = async () => {
    const id = await ensureScheduleId()
    if (id !== null) {
      setShowBiblePassagePicker(true)
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

  const handleOpenExportModal = useCallback(() => {
    setShowExportFormatModal(true)
  }, [])

  const handleExportFormatConfirm = useCallback(
    async (format: ScheduleExportFormat) => {
      setShowExportFormatModal(false)
      if (!schedule) return

      const result = await saveSchedule(schedule, format)
      if (result.success) {
        showToast(t('messages.savedToFile'), 'success')
      } else if (result.error) {
        showToast(result.error, 'error')
      }
    },
    [schedule, saveSchedule, showToast, t],
  )

  const handleLoadFromFile = useCallback(async () => {
    const result = await loadSchedule()
    if (result.cancelled) return

    if (!result.success || !result.data) {
      showToast(result.error ?? t('messages.error'), 'error')
      return
    }

    setImportData(result.data)
    setShowImportConfirmModal(true)
  }, [loadSchedule, showToast, t])

  const handleImportConfirm = useCallback(async () => {
    if (!effectiveScheduleId || !importData) return

    const result = await importItems(effectiveScheduleId, importData)

    setShowImportConfirmModal(false)
    setImportData(null)

    if (result.success) {
      const messages: string[] = [
        t('messages.imported', { count: result.itemCount }),
      ]
      if (result.skippedSongs && result.skippedSongs.length > 0) {
        messages.push(
          t('messages.skippedSongs', { count: result.skippedSongs.length }),
        )
      }
      if (
        result.skippedBiblePassages &&
        result.skippedBiblePassages.length > 0
      ) {
        messages.push(
          t('messages.skippedBiblePassages', {
            count: result.skippedBiblePassages.length,
          }),
        )
      }
      showToast(messages.join('. '), 'success')
      refetch()
    } else {
      showToast(result.error ?? t('messages.error'), 'error')
    }
  }, [effectiveScheduleId, importData, importItems, showToast, t, refetch])

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
        <Tooltip content={t('actions.back')} position="bottom">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">{t('actions.back')}</span>
          </button>
        </Tooltip>

        <div className="flex items-center gap-2">
          {/* Save button - always visible when there are unsaved changes or creating new */}
          {(hasUnsavedChanges || scheduleId === null) && (
            <Tooltip content={t('actions.save', 'Save')} position="bottom">
              <button
                type="button"
                onClick={handleManualSave}
                disabled={upsertSchedule.isPending || !title.trim()}
                className="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 text-sm text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {upsertSchedule.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                <span className="hidden sm:inline">
                  {t('actions.save', 'Save')}
                </span>
              </button>
            </Tooltip>
          )}
          {effectiveScheduleId !== null && (
            <>
              <Tooltip content={t('actions.loadFromFile')} position="bottom">
                <button
                  type="button"
                  onClick={handleLoadFromFile}
                  disabled={isLoadingFile || isImporting}
                  className="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 text-sm text-white bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoadingFile || isImporting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  <span className="hidden sm:inline">
                    {t('actions.loadFromFile')}
                  </span>
                </button>
              </Tooltip>
              <Tooltip content={t('actions.saveToFile')} position="bottom">
                <button
                  type="button"
                  onClick={handleOpenExportModal}
                  disabled={isSaving}
                  className="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 text-sm text-white bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  <span className="hidden sm:inline">
                    {t('actions.saveToFile')}
                  </span>
                </button>
              </Tooltip>
              <Tooltip content={t('actions.delete')} position="bottom">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      {/* Title & Description */}
      <div className="space-y-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="space-y-1.5">
          <label
            htmlFor="schedule-title"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t('editor.title', 'Title')}
          </label>
          <input
            id="schedule-title"
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder={t('editor.titlePlaceholder')}
            className="w-full px-3 py-2 text-base font-semibold bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-gray-900 dark:text-white placeholder-gray-400 transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="schedule-description"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t('editor.description', 'Description')}
          </label>
          <textarea
            id="schedule-description"
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder={t('editor.descriptionPlaceholder')}
            rows={3}
            className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-gray-600 dark:text-gray-300 placeholder-gray-400 transition-colors"
          />
        </div>
      </div>

      {/* Items Section - only show for existing schedules */}
      {effectiveScheduleId !== null && (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('editor.items')}
            </h3>
            <div className="flex items-center gap-2">
              <Tooltip content={t('actions.editAsText')} position="bottom">
                <button
                  type="button"
                  onClick={() => setShowEditAsText(true)}
                  className="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 text-sm text-amber-900 bg-amber-400 hover:bg-amber-500 dark:text-amber-100 dark:bg-amber-700 dark:hover:bg-amber-600 rounded-lg transition-colors"
                >
                  <FileText size={16} />
                  <span className="hidden sm:inline">
                    {t('actions.editAsText')}
                  </span>
                </button>
              </Tooltip>
              <AddToScheduleMenu
                onAddSong={handleAddSong}
                onAddBiblePassage={handleAddBiblePassage}
                onAddSlide={handleAddSlide}
              />
            </div>
          </div>

          <ScheduleItemList
            scheduleId={effectiveScheduleId}
            items={localItems}
            isLoading={isLoading}
            onReorder={handleReorderItems}
            onRemoveItem={handleRemoveItem}
          />
        </div>
      )}

      {/* Song Picker Modal */}
      <SongPickerModal
        isOpen={showSongPicker}
        onClose={() => setShowSongPicker(false)}
        onSongSelect={handleSongSelected}
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

      {/* Bible Passage Picker Modal */}
      {effectiveScheduleId !== null && (
        <BiblePassagePickerModal
          isOpen={showBiblePassagePicker}
          onClose={() => setShowBiblePassagePicker(false)}
          scheduleId={effectiveScheduleId}
          onSaved={() => {
            refetch()
          }}
        />
      )}

      {/* Export Format Modal */}
      <ScheduleExportFormatModal
        isOpen={showExportFormatModal}
        onConfirm={handleExportFormatConfirm}
        onCancel={() => setShowExportFormatModal(false)}
      />

      {/* Import Confirmation Dialog */}
      <dialog
        ref={importDialogRef}
        onCancel={() => {
          setShowImportConfirmModal(false)
          setImportData(null)
        }}
        onClick={(e) => {
          if (e.target === importDialogRef.current) {
            setShowImportConfirmModal(false)
            setImportData(null)
          }
        }}
        className="fixed inset-0 m-auto w-full max-w-md p-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl backdrop:bg-black/50"
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t('import.title')}
          </h3>
          {importData && (
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                {t('import.message', { title: importData.schedule.title })}
              </p>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {t('import.warning')}
                </p>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p>
                  {t('import.itemCount', { count: importData.items.length })}
                </p>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => {
                setShowImportConfirmModal(false)
                setImportData(null)
              }}
              className="flex items-center gap-2 px-4 py-2 text-white bg-gray-600 hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              <X size={16} />
              {t('actions.cancel', { ns: 'common' })}
            </button>
            <button
              type="button"
              onClick={handleImportConfirm}
              disabled={isImporting}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isImporting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              {t('import.confirm')}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
