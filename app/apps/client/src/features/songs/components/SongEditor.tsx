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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  useNavigateTemporary,
  usePresentationState,
  usePresentTemporarySong,
} from '~/features/presentation'
import type { ScheduleItem } from '~/features/schedules'
import {
  AddSongToScheduleModal,
  getSchedulePassageTarget,
  ScheduleLiveItemPanel,
  SchedulePanel,
  useScheduleFlatNavigation,
  useSelectedScheduleId,
} from '~/features/schedules'
import { useToast } from '~/ui/toast'
import {
  defaultSongMetadata,
  SongDetailsSection,
  type SongMetadata,
} from './SongDetailsSection'
import { SongEditorSlideRail } from './SongEditorSlideRail'
import { type LocalSlide } from './SongSlideList'
import { SongSlidesSection } from './SongSlidesSection'
import type { SongSlide } from '../types'
import { expandSongSlidesWithChoruses } from '../utils/expandSongSlides'

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
  const [showAddToScheduleModal, setShowAddToScheduleModal] = useState(false)
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [isSavingBeforeAction, setIsSavingBeforeAction] = useState(false)
  const unsavedChangesDialogRef = useRef<HTMLDialogElement>(null)
  const presentTemporarySong = usePresentTemporarySong()
  const { data: presentationState } = usePresentationState()
  const navigateTemporary = useNavigateTemporary()
  // The Programe panel's selection is shared app-wide; while a step of that
  // program is live, the rail's arrows walk the program instead of this song.
  const selectedScheduleId = useSelectedScheduleId()
  const scheduleNav = useScheduleFlatNavigation({
    scheduleId: selectedScheduleId,
  })
  const isScheduleLive = scheduleNav.isScheduleLive

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
        notes: s.notes ?? null,
        styleOverrides: s.styleOverrides ?? null,
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

  /** Which slide of THIS song is on the projector, after chorus expansion. */
  const presentedSlideIndex = useMemo(() => {
    if (!songId) return null
    const temp = presentationState?.temporaryContent
    if (temp?.type !== 'song' || temp.data.songId !== songId) return null
    return temp.data.currentSlideIndex
  }, [presentationState, songId])

  /**
   * This song's place in the selected program, if it has one. The occurrence
   * already on the projector wins, so a song listed twice keeps its place.
   */
  const scheduleItemForSong = useMemo(() => {
    if (!songId || !selectedScheduleId) return null
    const liveItem = scheduleNav.flatItems[scheduleNav.currentFlatIndex]?.item
    if (liveItem?.itemType === 'song' && liveItem.songId === songId) {
      return liveItem
    }
    return (
      scheduleNav.items.find(
        (item) => item.itemType === 'song' && item.songId === songId,
      ) ?? null
    )
  }, [
    songId,
    selectedScheduleId,
    scheduleNav.flatItems,
    scheduleNav.currentFlatIndex,
    scheduleNav.items,
  ])

  /** Projects one verse from the rail, as a program step where that applies. */
  const handlePresentRailSlide = useCallback(
    async (index: number) => {
      if (!songId) return
      if (scheduleItemForSong) {
        await scheduleNav.presentSongSlide(scheduleItemForSong, index)
        return
      }
      await presentTemporarySong.mutateAsync({ songId, slideIndex: index })
    },
    [songId, scheduleItemForSong, scheduleNav, presentTemporarySong],
  )

  const handleRailPrev = useCallback(async () => {
    if (isScheduleLive) {
      await scheduleNav.goPrev()
      return
    }
    if (presentedSlideIndex !== null) {
      await navigateTemporary.mutateAsync({ direction: 'prev' })
    }
  }, [isScheduleLive, scheduleNav, presentedSlideIndex, navigateTemporary])

  const handleRailNext = useCallback(async () => {
    if (isScheduleLive) {
      await scheduleNav.goNext()
      return
    }
    if (presentedSlideIndex !== null) {
      await navigateTemporary.mutateAsync({ direction: 'next' })
    }
  }, [isScheduleLive, scheduleNav, presentedSlideIndex, navigateTemporary])

  const canRailNavigatePrev = isScheduleLive
    ? scheduleNav.canNavigatePrev
    : presentedSlideIndex !== null && presentedSlideIndex > 0
  const canRailNavigateNext = isScheduleLive
    ? scheduleNav.canNavigateNext
    : presentedSlideIndex !== null

  /**
   * While a program step is live the rail follows the projector rather than the
   * draft — except when the live step IS a slide of this song, where the draft
   * list already shows it (and shows the unsaved edits with it).
   */
  const liveProgramItem = isScheduleLive
    ? scheduleNav.flatItems[scheduleNav.currentFlatIndex]?.item
    : undefined
  const showsLiveProgramItem =
    !!liveProgramItem &&
    !(liveProgramItem.itemType === 'song' && liveProgramItem.songId === songId)

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

  /** A program's verse row was clicked — open it in the Bible module. */
  const handleSelectSchedulePassage = (item: ScheduleItem) => {
    const target = getSchedulePassageTarget(item)
    if (!target) return
    navigate({
      to: '/bible',
      search: {
        bookName: target.bookName,
        chapter: target.chapter,
        verse: target.verse,
        select: true,
      },
    })
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
    <div className="flex gap-4">
      {/* Verse rail — the song as it reads right now, click to project. Desktop
          only: below `lg` the editor already fills the width. */}
      <aside className="hidden w-72 shrink-0 lg:block xl:w-80">
        <div className="sticky top-0 h-[calc(100vh-7rem)]">
          {showsLiveProgramItem ? (
            <div className="h-full overflow-hidden rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
              <ScheduleLiveItemPanel nav={scheduleNav} />
            </div>
          ) : (
            <SongEditorSlideRail
              slides={slides}
              presentedIndex={presentedSlideIndex}
              onPresentSlide={handlePresentRailSlide}
              onPrevSlide={handleRailPrev}
              onNextSlide={handleRailNext}
              canNavigatePrev={canRailNavigatePrev}
              canNavigateNext={canRailNavigateNext}
            />
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-6 [scrollbar-gutter:stable] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Header. The two asides steal 300-640px, so the room this row gets
            has nothing to do with the viewport width — a 1366px laptop leaves
            it ~600px. It is therefore a query container: the action labels
            (and the extra button padding they need) only appear once the row
            itself is wide enough for them AND a readable title. Below that the
            buttons stay as icons with their `title` tooltips, which keeps the
            <h1> from being squeezed to zero width. */}
        <div
          data-testid="song-editor-header"
          className="@container flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <button
              type="button"
              onClick={onBack}
              data-testid="song-editor-back"
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
            >
              <ArrowLeft
                size={20}
                className="text-gray-600 dark:text-gray-400"
              />
            </button>
            <h1
              data-testid="song-editor-title"
              className="text-xl font-bold text-gray-900 dark:text-white truncate"
            >
              {isLoading ? (
                <span className="inline-block w-48 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              ) : isNew ? (
                t('actions.create')
              ) : (
                title || t('editor.titlePlaceholder')
              )}
            </h1>
          </div>
          <div
            data-testid="song-editor-header-actions"
            className="flex items-center gap-2 justify-end shrink-0"
          >
            {!isNew && songId && (
              <>
                <button
                  type="button"
                  onClick={handleAddToScheduleClick}
                  disabled={isLoading}
                  className="px-2 py-2 @3xl:px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
                  title={t('songs:actions.addToSchedule')}
                >
                  <CalendarPlus size={20} />
                  <span className="hidden @3xl:inline">
                    {t('songs:actions.addToSchedule')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handlePresentNow}
                  disabled={isLoading || presentTemporarySong.isPending}
                  className="px-2 py-2 @3xl:px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
                  title={t('queue:actions.presentNow')}
                >
                  <Play size={20} />
                  <span className="hidden @3xl:inline">
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
              data-testid="song-editor-save"
              disabled={isSaving || isLoading || !title.trim() || !isDirty}
              className="px-2 py-2 @3xl:px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
              title={t('songs:actions.save')}
            >
              {isSaving ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Save size={20} />
              )}
              <span className="hidden @3xl:inline">
                {t('songs:actions.save')}
              </span>
            </button>
          </div>
        </div>

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

      {/* Programe — the same running order every other page shows, so an
          operator editing a song mid-service never loses their place. Widest
          screens only: below that the editor form needs the room. */}
      <aside className="hidden w-72 shrink-0 xl:block">
        <div className="sticky top-0 h-[calc(100vh-7rem)]">
          <SchedulePanel
            activeSongId={songId ?? undefined}
            onSelectSong={(targetSongId) =>
              navigate({
                to: '/songs/$songId',
                params: { songId: String(targetSongId) },
              })
            }
            onSelectPassage={handleSelectSchedulePassage}
            onOpenSchedule={(scheduleId) =>
              navigate({
                to: '/schedules/$scheduleId',
                params: { scheduleId: String(scheduleId) },
              })
            }
            candidateSong={songId ? { id: songId, title } : null}
          />
        </div>
      </aside>
    </div>
  )
}
