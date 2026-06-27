import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarPlus,
  LayoutList,
  Loader2,
  Play,
  Projector,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  usePresentationState,
  usePresentTemporarySong,
} from '~/features/presentation'
import { AddSongToScheduleModal } from '~/features/schedules'
import { useToast } from '~/ui/toast'
import {
  defaultSongMetadata,
  SongDetailsSection,
  type SongMetadata,
} from './SongDetailsSection'
import { type LocalSlide } from './SongSlideList'
import { SongSlidesSection } from './SongSlidesSection'
import { SongStageEditor } from './stage-editor'
import type { SongSlide } from '../types'
import { expandSongSlidesWithChoruses } from '../utils/expandSongSlides'

type PendingAction = 'present' | 'addToSchedule' | null
type EditorView = 'form' | 'stage'

interface SongEditorProps {
  isNew: boolean
  isLoading?: boolean
  isSaving: boolean
  isDeleting?: boolean
  isDirty?: boolean
  songId: number | null
  title: string
  categoryId: number | null
  tagIds: number[]
  slides: LocalSlide[]
  metadata?: SongMetadata
  // Read-only tracking fields
  presentationCount?: number
  lastManualEdit?: number | null
  onTitleChange: (title: string) => void
  onCategoryChange: (categoryId: number | null) => void
  onTagsChange: (tagIds: number[]) => void
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
  tagIds,
  slides,
  metadata = defaultSongMetadata,
  presentationCount = 0,
  lastManualEdit,
  onTitleChange,
  onCategoryChange,
  onTagsChange,
  onSlidesChange,
  onMetadataChange,
  onSave,
  onDelete,
  onBack,
}: SongEditorProps) {
  const { t } = useTranslation(['songs', 'queue'])
  const navigate = useNavigate()
  const { showToast } = useToast()
  // Existing songs open straight into the PowerPoint-style slide editor (the
  // primary "Edit" action). New songs start in the form so the title, category
  // and metadata can be filled in first.
  const [view, setView] = useState<EditorView>(isNew ? 'form' : 'stage')
  const [showAddToScheduleModal, setShowAddToScheduleModal] = useState(false)
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [isSavingBeforeAction, setIsSavingBeforeAction] = useState(false)
  const unsavedChangesDialogRef = useRef<HTMLDialogElement>(null)
  const presentTemporarySong = usePresentTemporarySong()
  const { data: presentationState } = usePresentationState()

  // Build expanded slides locally to map a saved slide id → its first
  // displayIndex (the server expands the same way from its saved data).
  const displayIndexBySlideId = useMemo(() => {
    const expandable: SongSlide[] = slides
      .filter((s) => typeof s.id === 'number')
      .map((s) => ({
        id: s.id as number,
        songId: songId ?? 0,
        content: s.content,
        chords: s.chords ?? null,
        sortOrder: s.sortOrder,
        label: s.label ?? null,
        createdAt: 0,
        updatedAt: 0,
      }))
    const expanded = expandSongSlidesWithChoruses(expandable)
    const map = new Map<number, number>()
    for (const es of expanded) {
      if (!map.has(es.id)) map.set(es.id, es.displayIndex)
    }
    return map
  }, [slides, songId])

  const presentedSlideId = useMemo(() => {
    if (!songId) return null
    const temp = presentationState?.temporaryContent
    if (temp?.type !== 'song' || temp.data.songId !== songId) return null
    const presentedExpandedIdx = temp.data.currentSlideIndex
    const presented = temp.data.slides?.[presentedExpandedIdx]
    return presented?.id ?? null
  }, [presentationState, songId])

  const handlePresentSlide = useMemo(() => {
    if (!songId) return undefined
    return (slideId: number) => {
      const slideIndex = displayIndexBySlideId.get(slideId) ?? 0
      void presentTemporarySong.mutateAsync({ songId, slideIndex })
    }
  }, [songId, displayIndexBySlideId, presentTemporarySong])

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

      {/* View toggle: form editor vs PowerPoint-style stage editor */}
      <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-800/50">
        <button
          type="button"
          data-testid="song-view-form"
          onClick={() => setView('form')}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            view === 'form'
              ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <LayoutList size={16} />
          {t('songs:editor.viewForm')}
        </button>
        <button
          type="button"
          data-testid="song-view-stage"
          onClick={() => setView('stage')}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            view === 'stage'
              ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          <Projector size={16} />
          {t('songs:editor.viewStage')}
        </button>
      </div>

      {view === 'form' ? (
        <>
          {/* Song Details */}
          <SongDetailsSection
            title={title}
            categoryId={categoryId}
            tagIds={tagIds}
            metadata={metadata}
            isLoading={isLoading}
            isNew={isNew}
            presentationCount={presentationCount}
            lastManualEdit={lastManualEdit}
            onTitleChange={onTitleChange}
            onCategoryChange={onCategoryChange}
            onTagsChange={onTagsChange}
            onMetadataChange={handleMetadataChange}
          />

          {/* Slides Section */}
          <SongSlidesSection
            slides={slides}
            presentedSlideId={presentedSlideId}
            onSlidesChange={onSlidesChange}
            onPresentSlide={handlePresentSlide}
            isLoading={isLoading}
          />
        </>
      ) : (
        <SongStageEditor
          slides={slides}
          title={title}
          keyLine={metadata.keyLine}
          songId={songId}
          presentedSlideId={presentedSlideId}
          onSlidesChange={onSlidesChange}
        />
      )}

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
