import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  FileText,
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
import { CategoryPicker } from './CategoryPicker'
import { EditSlidesAsTextModal } from './EditSlidesAsTextModal'
import { type LocalSlide, SongSlideList } from './SongSlideList'

type PendingAction = 'present' | 'addToSchedule' | null

// IMPORTANT: When adding new metadata fields, ensure they are also included in:
// 1. SongMetadata interface below
// 2. defaultMetadata object
// 3. The parent component's save handler (e.g., $songId.tsx handleSave)
// 4. SongEditorModal.tsx (both state initialization and handleSave)
// 5. UpsertSongInput type in features/songs/types.ts
// 6. Server-side songs service
interface SongMetadata {
  author: string | null
  copyright: string | null
  ccli: string | null
  key: string | null
  tempo: string | null
  timeSignature: string | null
  theme: string | null
  altTheme: string | null
  hymnNumber: string | null
  keyLine: string | null
  presentationOrder: string | null
  sourceFilename: string | null
}

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

const defaultMetadata: SongMetadata = {
  author: null,
  copyright: null,
  ccli: null,
  key: null,
  tempo: null,
  timeSignature: null,
  theme: null,
  altTheme: null,
  hymnNumber: null,
  keyLine: null,
  presentationOrder: null,
  sourceFilename: null,
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
  metadata = defaultMetadata,
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
  const [showEditAsTextModal, setShowEditAsTextModal] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
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

  const handleMetadataFieldChange = (
    field: keyof SongMetadata,
    value: string,
  ) => {
    if (onMetadataChange) {
      onMetadataChange(field, value || null)
    }
  }

  // Check if there's any metadata to show in the collapsed summary
  const hasMetadata = metadata.author || metadata.hymnNumber || metadata.key

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
            onClick={onSave}
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
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('editor.titlePlaceholder').replace('...', '')}
            </label>
            {isLoading ? (
              <div className="w-full h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            ) : (
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white"
                placeholder={t('editor.titlePlaceholder')}
              />
            )}
          </div>

          {/* Key Line (always visible) */}
          <div>
            <label
              htmlFor="keyLine"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('metadata.keyLine')}
            </label>
            {isLoading ? (
              <div className="w-full h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            ) : (
              <input
                id="keyLine"
                type="text"
                value={metadata.keyLine || ''}
                onChange={(e) =>
                  handleMetadataFieldChange('keyLine', e.target.value)
                }
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white"
                placeholder={t('metadata.keyLinePlaceholder')}
              />
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('category.name')}
            </label>
            {isLoading ? (
              <div className="w-full h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            ) : (
              <CategoryPicker value={categoryId} onChange={onCategoryChange} />
            )}
          </div>

          {/* Collapsible Details Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              {showDetails ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
              {t('metadata.detailsSection')}
              {!showDetails && hasMetadata && (
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  {[
                    metadata.author,
                    metadata.hymnNumber && `#${metadata.hymnNumber}`,
                    metadata.key,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}
            </button>

            {showDetails && !isLoading && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Author */}
                <div>
                  <label
                    htmlFor="author"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    {t('metadata.author')}
                  </label>
                  <input
                    id="author"
                    type="text"
                    value={metadata.author || ''}
                    onChange={(e) =>
                      handleMetadataFieldChange('author', e.target.value)
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                {/* Copyright */}
                <div>
                  <label
                    htmlFor="copyright"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    {t('metadata.copyright')}
                  </label>
                  <input
                    id="copyright"
                    type="text"
                    value={metadata.copyright || ''}
                    onChange={(e) =>
                      handleMetadataFieldChange('copyright', e.target.value)
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                {/* CCLI */}
                <div>
                  <label
                    htmlFor="ccli"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    {t('metadata.ccli')}
                  </label>
                  <input
                    id="ccli"
                    type="text"
                    value={metadata.ccli || ''}
                    onChange={(e) =>
                      handleMetadataFieldChange('ccli', e.target.value)
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                {/* Hymn Number */}
                <div>
                  <label
                    htmlFor="hymnNumber"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    {t('metadata.hymnNumber')}
                  </label>
                  <input
                    id="hymnNumber"
                    type="text"
                    value={metadata.hymnNumber || ''}
                    onChange={(e) =>
                      handleMetadataFieldChange('hymnNumber', e.target.value)
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                {/* Tempo */}
                <div>
                  <label
                    htmlFor="tempo"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    {t('metadata.tempo')}
                  </label>
                  <input
                    id="tempo"
                    type="text"
                    value={metadata.tempo || ''}
                    onChange={(e) =>
                      handleMetadataFieldChange('tempo', e.target.value)
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                {/* Time Signature */}
                <div>
                  <label
                    htmlFor="timeSignature"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    {t('metadata.timeSignature')}
                  </label>
                  <input
                    id="timeSignature"
                    type="text"
                    value={metadata.timeSignature || ''}
                    onChange={(e) =>
                      handleMetadataFieldChange('timeSignature', e.target.value)
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                {/* Theme */}
                <div>
                  <label
                    htmlFor="theme"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    {t('metadata.theme')}
                  </label>
                  <input
                    id="theme"
                    type="text"
                    value={metadata.theme || ''}
                    onChange={(e) =>
                      handleMetadataFieldChange('theme', e.target.value)
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                {/* Alternative Theme */}
                <div>
                  <label
                    htmlFor="altTheme"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    {t('metadata.altTheme')}
                  </label>
                  <input
                    id="altTheme"
                    type="text"
                    value={metadata.altTheme || ''}
                    onChange={(e) =>
                      handleMetadataFieldChange('altTheme', e.target.value)
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                {/* Source File Path (read-only) */}
                {metadata.sourceFilename && (
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="sourceFilename"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      {t('metadata.sourceFilename')}
                    </label>
                    <input
                      id="sourceFilename"
                      type="text"
                      value={metadata.sourceFilename || ''}
                      readOnly
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 text-sm cursor-not-allowed"
                    />
                  </div>
                )}

                {/* Presentation Order (read-only) */}
                {metadata.presentationOrder && (
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="presentationOrder"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      {t('metadata.presentationOrder')}
                    </label>
                    <input
                      id="presentationOrder"
                      type="text"
                      value={metadata.presentationOrder || ''}
                      readOnly
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 text-sm cursor-not-allowed"
                    />
                  </div>
                )}

                {/* Tracking Stats (read-only) */}
                {!isNew && (
                  <>
                    <div>
                      <label
                        htmlFor="presentationCount"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        {t('metadata.presentationCount')}
                      </label>
                      <input
                        id="presentationCount"
                        type="text"
                        value={presentationCount}
                        readOnly
                        className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 text-sm cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="lastManualEdit"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        {t('metadata.lastManualEdit')}
                      </label>
                      <input
                        id="lastManualEdit"
                        type="text"
                        value={
                          lastManualEdit
                            ? new Date(lastManualEdit).toLocaleString()
                            : t('metadata.neverEdited')
                        }
                        readOnly
                        className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 text-sm cursor-not-allowed"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slides Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('editor.slides')} ({isLoading ? '-' : slides.length})
          </h2>
          <button
            type="button"
            onClick={() => setShowEditAsTextModal(true)}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-900 bg-amber-400 hover:bg-amber-500 dark:text-amber-100 dark:bg-amber-700 dark:hover:bg-amber-600 rounded-lg transition-colors disabled:opacity-50"
          >
            <FileText className="w-5 h-5" />
            {t('actions.editAsText')}
          </button>
        </div>
        <div className="p-6 bg-gray-100 dark:bg-gray-900/30">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            </div>
          ) : (
            <SongSlideList slides={slides} onSlidesChange={onSlidesChange} />
          )}
        </div>
      </div>

      <EditSlidesAsTextModal
        isOpen={showEditAsTextModal}
        onClose={() => setShowEditAsTextModal(false)}
        slides={slides}
        onSlidesChange={onSlidesChange}
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
