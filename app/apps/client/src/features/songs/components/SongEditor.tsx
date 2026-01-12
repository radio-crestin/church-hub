import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarPlus,
  Loader2,
  Play,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePresentTemporarySong } from '~/features/presentation'
import { AddSongToScheduleModal } from '~/features/schedules'
import { useToast } from '~/ui/toast'
import {
  defaultSongMetadata,
  SongDetailsSection,
  type SongMetadata,
} from './SongDetailsSection'
import { type LocalSlide } from './SongSlideList'
import { SongSlidesSection } from './SongSlidesSection'

type PendingAction = 'present' | 'addToSchedule' | null

interface SongEditorProps {
  isNew: boolean
  isLoading?: boolean
  isSaving: boolean
  isDeleting?: boolean
  isDirty?: boolean
  songId: number | null
  title: string
  categoryId: number | null
  slides: LocalSlide[]
  metadata?: SongMetadata
  // Read-only tracking fields
  presentationCount?: number
  lastManualEdit?: number | null
  onTitleChange: (title: string) => void
  onCategoryChange: (categoryId: number | null) => void
  onSlidesChange: (slides: LocalSlide[]) => void
  onMetadataChange?: (field: keyof SongMetadata, value: string | null) => void
  onSave: () => Promise<boolean>
  onDelete?: () => void
  onBack: () => void
}

export function SongEditor({
  isNew,
  isLoading,
  isSaving,
  isDeleting,
  isDirty = true,
  songId,
  title,
  categoryId,
  slides,
  metadata = defaultSongMetadata,
  presentationCount = 0,
  lastManualEdit,
  onTitleChange,
  onCategoryChange,
  onSlidesChange,
  onMetadataChange,
  onSave,
  onDelete,
  onBack,
}: SongEditorProps) {
  const { t } = useTranslation(['songs', 'queue'])
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [showAddToScheduleModal, setShowAddToScheduleModal] = useState(false)
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [isSavingBeforeAction, setIsSavingBeforeAction] = useState(false)
  const unsavedChangesDialogRef = useRef<HTMLDialogElement>(null)
  const presentTemporarySong = usePresentTemporarySong()

  // Handle unsaved changes dialog open/close
  useEffect(() => {
    if (showUnsavedChangesModal) {
      unsavedChangesDialogRef.current?.showModal()
    } else {
      unsavedChangesDialogRef.current?.close()
    }
  }, [showUnsavedChangesModal])

  const executePresentNow = async () => {
    if (!songId) return

    try {
      await presentTemporarySong.mutateAsync({ songId, slideIndex: 0 })
      showToast(t('queue:messages.presenting'), 'success')
      navigate({ to: '/songs/$songId', params: { songId: String(songId) } })
    } catch {
      showToast(t('queue:messages.error'), 'error')
    }
  }

  const handlePresentNow = () => {
    if (!songId) return

    if (isDirty) {
      setPendingAction('present')
      setShowUnsavedChangesModal(true)
    } else {
      executePresentNow()
    }
  }

  const handleAddToScheduleClick = () => {
    if (!songId) return

    if (isDirty) {
      setPendingAction('addToSchedule')
      setShowUnsavedChangesModal(true)
    } else {
      setShowAddToScheduleModal(true)
    }
  }

  const handleSaveAndContinue = async () => {
    setIsSavingBeforeAction(true)
    const saveSuccess = await onSave()
    setIsSavingBeforeAction(false)
    setShowUnsavedChangesModal(false)

    if (saveSuccess) {
      if (pendingAction === 'present') {
        executePresentNow()
      } else if (pendingAction === 'addToSchedule') {
        setShowAddToScheduleModal(true)
      }
    }
    setPendingAction(null)
  }

  const handleContinueWithoutSaving = () => {
    setShowUnsavedChangesModal(false)
    if (pendingAction === 'present') {
      executePresentNow()
    } else if (pendingAction === 'addToSchedule') {
      setShowAddToScheduleModal(true)
    }
    setPendingAction(null)
  }

  const handleCancelAction = () => {
    setShowUnsavedChangesModal(false)
    setPendingAction(null)
  }

  const handleSongAddedToSchedule = (scheduleId: number) => {
    navigate({
      to: '/schedules/$scheduleId',
      params: { scheduleId: String(scheduleId) },
    })
  }

  const handleMetadataChange = (
    field: keyof SongMetadata,
    value: string | null,
  ) => {
    if (onMetadataChange) {
      onMetadataChange(field, value)
    }
  }

  return (
    <div className="space-y-6 [scrollbar-gutter:stable] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
            {isLoading ? (
              <span className="inline-block w-48 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ) : isNew ? (
              t('actions.create')
            ) : (
              title || t('editor.titlePlaceholder')
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2 justify-end shrink-0">
          {!isNew && songId && (
            <>
              <button
                type="button"
                onClick={handleAddToScheduleClick}
                disabled={isLoading}
                className="p-2 sm:px-4 sm:py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
                title={t('songs:actions.addToSchedule')}
              >
                <CalendarPlus size={20} />
                <span className="hidden sm:inline">
                  {t('songs:actions.addToSchedule')}
                </span>
              </button>
              <button
                type="button"
                onClick={handlePresentNow}
                disabled={isLoading || presentTemporarySong.isPending}
                className="p-2 sm:px-4 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
                title={t('queue:actions.presentNow')}
              >
                <Play size={20} />
                <span className="hidden sm:inline">
                  {t('queue:actions.presentNow')}
                </span>
              </button>
            </>
          )}
          {!isNew && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting || isLoading}
              className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              title={t('songs:actions.delete')}
            >
              {isDeleting ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Trash2 size={20} />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => onSave()}
            disabled={isSaving || isLoading || !title.trim() || !isDirty}
            className="p-2 sm:px-4 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
            title={t('songs:actions.save')}
          >
            {isSaving ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Save size={20} />
            )}
            <span className="hidden sm:inline">{t('songs:actions.save')}</span>
          </button>
        </div>
      </div>

      {/* Song Details */}
      <SongDetailsSection
        title={title}
        categoryId={categoryId}
        metadata={metadata}
        isLoading={isLoading}
        isNew={isNew}
        presentationCount={presentationCount}
        lastManualEdit={lastManualEdit}
        onTitleChange={onTitleChange}
        onCategoryChange={onCategoryChange}
        onMetadataChange={handleMetadataChange}
      />

      {/* Slides Section */}
      <SongSlidesSection
        slides={slides}
        onSlidesChange={onSlidesChange}
        isLoading={isLoading}
      />

      {songId && (
        <AddSongToScheduleModal
          isOpen={showAddToScheduleModal}
          songId={songId}
          onClose={() => setShowAddToScheduleModal(false)}
          onAdded={handleSongAddedToSchedule}
        />
      )}

      {/* Unsaved Changes Confirmation Modal */}
      <dialog
        ref={unsavedChangesDialogRef}
        className="fixed inset-0 m-auto w-full max-w-md p-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl backdrop:bg-black/50"
        onClick={(e) => {
          if (
            e.target === unsavedChangesDialogRef.current &&
            !isSavingBeforeAction
          )
            handleCancelAction()
        }}
      >
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isSavingBeforeAction
                ? t('songs:actions.save')
                : t('songs:modal.unsavedChangesTitle')}
            </h2>
            {!isSavingBeforeAction && (
              <button
                type="button"
                onClick={handleCancelAction}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={20} className="text-gray-500" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-4">
            {isSavingBeforeAction ? (
              <div className="flex flex-col items-center justify-center py-4 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('songs:messages.saving')}
                </p>
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">
                {t('songs:modal.unsavedBeforeActionMessage')}
              </p>
            )}
          </div>

          {/* Footer */}
          {!isSavingBeforeAction && (
            <div className="flex flex-col gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handleSaveAndContinue}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                {t('songs:modal.saveAndContinue')}
              </button>
              <button
                type="button"
                onClick={handleContinueWithoutSaving}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                {t('songs:modal.continueWithoutSaving')}
              </button>
              <button
                type="button"
                onClick={handleCancelAction}
                className="w-full px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                {t('songs:modal.cancel')}
              </button>
            </div>
          )}
        </div>
      </dialog>
    </div>
  )
}
