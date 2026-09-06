import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Check,
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { clearSectionLastVisited } from '~/features/navigation'
import { useClearTemporaryContent, useWebSocket } from '~/features/presentation'
import {
  type ChurchProgramData,
  type ScheduleExportFormat,
  ScheduleExportFormatModal,
  useImportScheduleItems,
  useLoadScheduleFromFile,
  useSaveScheduleToFile,
} from '~/features/schedule-export'
import {
  KeyLineEditDialog,
  type KeyLineEditDialogHandle,
} from '~/features/song-key'
import { SongEditorModal, SongPickerModal } from '~/features/songs/components'
import { getSongById } from '~/features/songs/service'
import type { WorkspaceLayout, WorkspacePanel } from '~/features/workspace'
import { useEditLayoutAction, Workspace } from '~/features/workspace'
import { ActionMenu } from '~/ui/menu'
import { useToast } from '~/ui/toast'
import { AddScheduleItemModal } from './AddScheduleItemModal'
import { BiblePassagePickerModal } from './BiblePassagePickerModal'
import { EditAsTextModal } from './EditAsTextModal'
import { InsertSlideModal } from './InsertSlideModal'
import { ScenePickerModal } from './ScenePickerModal'
import { ScheduleItemsPanel } from './ScheduleItemsPanel'
import { SchedulePreviewPanel } from './SchedulePreviewPanel'
import {
  useAddItemToSchedule,
  useDeleteSchedule,
  useMarkScheduleItemSung,
  useReorderScheduleItems,
  useSchedule,
  useScheduleFlatNavigation,
  useScheduleKeyboardShortcuts,
  useUpsertSchedule,
} from '../hooks'
import type { ScheduleItem, SlideTemplate } from '../types'

/**
 * A program opens as the item list beside the live preview. Dragging the
 * preview onto the list's bottom edge stacks them instead — whichever suits
 * the operator's screen.
 */
const SCHEDULE_WORKSPACE_LAYOUT: WorkspaceLayout = {
  columns: [
    { id: 'col-1', panelIds: ['items'] },
    { id: 'col-2', panelIds: ['preview'] },
  ],
}

interface SchedulePresenterProps {
  scheduleId: number
  onBack: () => void
  onDeleted?: () => void
  /** URL param for deep-linking to a specific item */
  urlItemIndex?: number
}

export function SchedulePresenter({
  scheduleId,
  onBack,
  onDeleted,
  urlItemIndex,
}: SchedulePresenterProps) {
  const { t } = useTranslation('schedules')
  const { t: tCommon } = useTranslation('common')
  const editLayoutAction = useEditLayoutAction('schedule-presenter')
  const { showToast } = useToast()
  const navigate = useNavigate()

  // Connect to WebSocket for real-time updates
  useWebSocket()

  const {
    data: schedule,
    isLoading,
    isError,
    refetch,
  } = useSchedule(scheduleId)

  // Handle schedule not found - redirect to list with toast
  useEffect(() => {
    if (!isLoading && (!schedule || isError)) {
      // Clear last visited to prevent navigation loop
      clearSectionLastVisited('schedules')
      showToast(t('messages.notFound'), 'error')
      onBack()
    }
  }, [isLoading, schedule, isError, showToast, t, onBack])

  // Handle back button - clear last visited so user stays on list
  const handleBack = useCallback(() => {
    clearSectionLastVisited('schedules')
    onBack()
  }, [onBack])
  const clearTemporary = useClearTemporaryContent()
  const { saveSchedule, isPending: isSaving } = useSaveScheduleToFile()
  const { loadSchedule, isPending: isLoadingFile } = useLoadScheduleFromFile()
  const { importItems, isPending: isImporting } = useImportScheduleItems()
  const upsertSchedule = useUpsertSchedule()
  const deleteSchedule = useDeleteSchedule()
  const reorderItems = useReorderScheduleItems()
  const markSung = useMarkScheduleItemSung()
  const addItemMutation = useAddItemToSchedule()

  // Layout state
  const [isLargeScreen, setIsLargeScreen] = useState(false)

  // URL sync tracking - prevents loops when URL changes
  const lastUrlItemIndexRef = useRef<number | undefined>(undefined)
  const isInternalNavigationRef = useRef(false)

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Modal states
  const [showExportFormatModal, setShowExportFormatModal] = useState(false)
  const [showImportConfirmModal, setShowImportConfirmModal] = useState(false)
  const [importData, setImportData] = useState<ChurchProgramData | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSlideModal, setShowSlideModal] = useState(false)
  const [slideTemplate, setSlideTemplate] =
    useState<SlideTemplate>('announcement')
  const [showEditAsText, setShowEditAsText] = useState(false)
  const [showBiblePassagePicker, setShowBiblePassagePicker] = useState(false)
  const [showScenePicker, setShowScenePicker] = useState(false)
  const [editingSongId, setEditingSongId] = useState<number | null>(null)
  const [editingSlideItem, setEditingSlideItem] = useState<ScheduleItem | null>(
    null,
  )
  const [editingBiblePassageItem, setEditingBiblePassageItem] =
    useState<ScheduleItem | null>(null)
  const [changingSongItem, setChangingSongItem] = useState<ScheduleItem | null>(
    null,
  )
  // State to control Add Menu visibility (for reopening after closing sub-modals)
  const [showAddMenu, setShowAddMenu] = useState(false)

  // Expand/collapse all triggers
  const [allExpanded, setAllExpanded] = useState(false)
  const [expandAllTrigger, setExpandAllTrigger] = useState(0)
  const [collapseAllTrigger, setCollapseAllTrigger] = useState(0)

  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const importDialogRef = useRef<HTMLDialogElement>(null)
  const keyLineDialogRef = useRef<KeyLineEditDialogHandle>(null)

  // Track screen size for responsive layout
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024)
    }
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  // Dialog handling
  useEffect(() => {
    if (showDeleteConfirm) {
      deleteDialogRef.current?.showModal()
    } else {
      deleteDialogRef.current?.close()
    }
  }, [showDeleteConfirm])

  useEffect(() => {
    if (showImportConfirmModal) {
      importDialogRef.current?.showModal()
    } else {
      importDialogRef.current?.close()
    }
  }, [showImportConfirmModal])

  // Get all schedule items
  const items = useMemo(() => schedule?.items ?? [], [schedule?.items])

  // URL sync — the program page deep-links a step through ?itemIndex=. The nav
  // hook hands us the step that is about to go live so the URL can follow it.
  const handleBeforeNavigate = useCallback(
    (flatIndex: number) => {
      isInternalNavigationRef.current = true
      lastUrlItemIndexRef.current = flatIndex
      navigate({
        to: '/schedules/$scheduleId',
        params: { scheduleId: String(scheduleId) },
        search: { itemIndex: flatIndex },
        replace: true,
      })
    },
    [navigate, scheduleId],
  )

  const {
    flatItems,
    currentFlatIndex,
    canNavigatePrev,
    canNavigateNext,
    presentSongSlide,
    presentPassageVerse,
    presentVerseteEntry,
    presentAnnouncement,
    presentScene,
    presentFlatIndex,
    goNext,
    goPrev,
  } = useScheduleFlatNavigation({
    scheduleId,
    items,
    onBeforeNavigate: handleBeforeNavigate,
  })

  // Someone arrived on (or navigated to) a ?itemIndex= URL — put that step up.
  useEffect(() => {
    if (
      urlItemIndex === lastUrlItemIndexRef.current ||
      isInternalNavigationRef.current
    ) {
      isInternalNavigationRef.current = false
      return
    }

    lastUrlItemIndexRef.current = urlItemIndex

    if (urlItemIndex !== undefined && flatItems.length > 0) {
      void presentFlatIndex(urlItemIndex)
    }
  }, [urlItemIndex, flatItems.length, presentFlatIndex])

  // Title editing handlers
  const handleStartEditTitle = useCallback(() => {
    setEditedTitle(schedule?.title ?? '')
    setIsEditingTitle(true)
  }, [schedule?.title])

  const handleSaveTitle = useCallback(async () => {
    if (!editedTitle.trim()) {
      showToast(t('messages.titleRequired'), 'error')
      return
    }

    const result = await upsertSchedule.mutateAsync({
      id: scheduleId,
      title: editedTitle.trim(),
      description: schedule?.description ?? null,
    })

    if (result.success) {
      setIsEditingTitle(false)
      showToast(t('messages.saved'), 'success')
    } else {
      showToast(t('messages.error'), 'error')
    }
  }, [
    editedTitle,
    scheduleId,
    schedule?.description,
    upsertSchedule,
    showToast,
    t,
  ])

  const handleCancelEditTitle = useCallback(() => {
    setIsEditingTitle(false)
    setEditedTitle('')
  }, [])

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSaveTitle()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleCancelEditTitle()
      }
    },
    [handleSaveTitle, handleCancelEditTitle],
  )

  // The items panel talks in (item, sub-index); the nav hook owns the rest —
  // the flat index, the next-item preview and the URL sync.
  const handleSlideClick = presentSongSlide
  const handleVerseClick = presentPassageVerse
  const handleEntryClick = presentVerseteEntry
  const handleAnnouncementClick = presentAnnouncement
  const handleSceneClick = presentScene
  const handlePrevSlide = goPrev
  const handleNextSlide = goNext

  // Keyboard shortcuts for schedule navigation
  // Uses global keyboard context with PAGE priority to take precedence over
  // the default presentation navigation (which only knows about current song)
  useScheduleKeyboardShortcuts({
    onNextSlide: handleNextSlide,
    onPrevSlide: handlePrevSlide,
    onHidePresentation: () => clearTemporary.mutate(),
    canNavigateNext,
    canNavigatePrev,
    enabled: true,
  })

  // Edit handlers — called from AddScheduleItemModal, which closes itself
  // before handing off to a dedicated editor. Songs are picked inside that
  // modal now, so there is no separate "add song" handler here; the standalone
  // SongPickerModal is only used for *changing* an existing song.
  const handleAddSlide = useCallback((template: SlideTemplate) => {
    setSlideTemplate(template)
    setShowSlideModal(true)
  }, [])

  const handleAddBiblePassage = useCallback(() => {
    setShowBiblePassagePicker(true)
  }, [])

  const handleAddScene = useCallback(() => {
    setShowScenePicker(true)
  }, [])

  const handleSceneSelect = useCallback(
    (obsSceneName: string) => {
      addItemMutation.mutate(
        {
          scheduleId,
          input: {
            slideType: 'scene',
            obsSceneName,
          },
        },
        {
          onSuccess: () => {
            showToast(t('messages.itemAdded'), 'success')
            refetch()
          },
          onError: () => {
            showToast(t('messages.error'), 'error')
          },
        },
      )
    },
    [addItemMutation, scheduleId, showToast, t, refetch],
  )

  // Callback to reopen add menu after closing sub-modals (only for non-edit mode)
  const handleReopenAddMenu = useCallback(() => {
    setShowAddMenu(true)
  }, [])

  // Reorder handler
  const handleReorder = useCallback(
    async (oldIndex: number, newIndex: number) => {
      const newItems = [...items]
      const [removed] = newItems.splice(oldIndex, 1)
      newItems.splice(newIndex, 0, removed)

      await reorderItems.mutateAsync({
        scheduleId,
        input: { itemIds: newItems.map((item) => item.id) },
      })
    },
    [items, scheduleId, reorderItems],
  )

  /** Ticks a program item off — songs, readings, announcements, scenes alike. */
  const handleToggleSung = useCallback(
    (item: ScheduleItem) => {
      markSung.mutate({
        scheduleId,
        itemId: item.id,
        isSung: !item.isSung,
      })
    },
    [markSung, scheduleId],
  )

  // Edit song handler (double-click)
  const handleEditSong = useCallback((songId: number) => {
    setEditingSongId(songId)
  }, [])

  // Delete item handler
  const handleDeleteItem = useCallback(
    async (item: ScheduleItem) => {
      const { removeItemFromSchedule } = await import('../service/schedules')
      const success = await removeItemFromSchedule(scheduleId, item.id)
      if (success) {
        showToast(t('messages.itemRemoved'), 'success')
        refetch()
      } else {
        showToast(t('messages.error'), 'error')
      }
    },
    [scheduleId, showToast, t, refetch],
  )

  // Edit item handler (for non-song items)
  const handleEditItem = useCallback((item: ScheduleItem) => {
    if (item.itemType === 'song' && item.songId) {
      setEditingSongId(item.songId)
    } else if (item.itemType === 'bible_passage') {
      // Open bible passage picker for editing
      setEditingBiblePassageItem(item)
    } else if (item.itemType === 'slide') {
      // Open slide modal for editing (announcements and versete tineri)
      setEditingSlideItem(item)
    }
  }, [])

  // Change song handler - replace song in schedule with another
  const handleChangeSong = useCallback((item: ScheduleItem) => {
    if (item.itemType === 'song') {
      setChangingSongItem(item)
    }
  }, [])

  // Edit key line handler - open key line dialog for the song
  const handleEditKeyLine = useCallback(async (item: ScheduleItem) => {
    if (item.itemType === 'song' && item.songId) {
      const song = await getSongById(item.songId)
      if (song) {
        keyLineDialogRef.current?.open(song)
      }
    }
  }, [])

  // Navigate to song page handler (middle-click)
  const handleNavigateToSong = useCallback(
    (songId: number) => {
      navigate({
        to: '/songs/$songId',
        params: { songId: String(songId) },
      })
    },
    [navigate],
  )

  const handleSongSelected = useCallback(
    async (songId: number) => {
      if (changingSongItem) {
        // Replace the song in the schedule at the same position
        const {
          removeItemFromSchedule,
          addItemToSchedule,
          reorderScheduleItems,
        } = await import('../service/schedules')

        // Find the position of the item being replaced
        const currentIndex = items.findIndex(
          (item) => item.id === changingSongItem.id,
        )
        const isFirstItem = currentIndex === 0
        const previousItem = currentIndex > 0 ? items[currentIndex - 1] : null

        // Remove old song first
        const removeSuccess = await removeItemFromSchedule(
          scheduleId,
          changingSongItem.id,
        )
        if (removeSuccess) {
          // Add new song
          const result = await addItemToSchedule(scheduleId, {
            songId,
            // If not the first item, insert after the previous item
            afterItemId: isFirstItem ? undefined : previousItem?.id,
          })

          if (result.success && result.data) {
            // If it was the first item, we need to reorder to move it to the front
            if (isFirstItem) {
              // Build new order: new item first, then all other items in their current order
              const otherItems = items.filter(
                (item) => item.id !== changingSongItem.id,
              )
              const newOrder = [result.data.id, ...otherItems.map((i) => i.id)]
              await reorderScheduleItems(scheduleId, { itemIds: newOrder })
            }
            showToast(t('messages.songReplaced'), 'success')
            refetch()
          }
        }
        setChangingSongItem(null)
      } else {
        // Add song via API - the schedule will be refetched automatically
        const { addItemToSchedule } = await import('../service/schedules')
        const result = await addItemToSchedule(scheduleId, { songId })
        if (result.success) {
          showToast(t('messages.itemAdded'), 'success')
          refetch()
        }
      }
    },
    [scheduleId, showToast, t, refetch, changingSongItem, items],
  )

  // Delete handler
  const handleDelete = useCallback(async () => {
    const success = await deleteSchedule.mutateAsync(scheduleId)
    if (success) {
      showToast(t('messages.deleted'), 'success')
      setShowDeleteConfirm(false)
      onDeleted?.()
      clearSectionLastVisited('schedules')
      navigate({ to: '/schedules' })
    } else {
      showToast(t('messages.error'), 'error')
    }
  }, [scheduleId, deleteSchedule, showToast, t, onDeleted, navigate])

  // Export handlers
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

  // Import handlers
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
    if (!importData) return

    const result = await importItems(scheduleId, importData)

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
  }, [scheduleId, importData, importItems, showToast, t, refetch])

  // Divider drag handlers

  if (isLoading || !schedule) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  // The item list and the live preview are both movable: an operator who wants
  // the preview under the list rather than beside it just drags it there.
  const workspacePanels: WorkspacePanel[] = [
    {
      id: 'preview',
      title: t('panel.previewTitle'),
      render: () => (
        <SchedulePreviewPanel
          canNavigatePrev={canNavigatePrev}
          canNavigateNext={canNavigateNext || currentFlatIndex < 0}
          onPrevSlide={handlePrevSlide}
          onNextSlide={handleNextSlide}
        />
      ),
    },
    {
      id: 'items',
      title: t('panel.itemsTitle'),
      render: () => (
        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between border-b border-gray-200 p-3 pb-2 lg:p-4 dark:border-gray-700">
            <button
              type="button"
              onClick={() => {
                if (allExpanded) {
                  setCollapseAllTrigger((prev) => prev + 1)
                } else {
                  setExpandAllTrigger((prev) => prev + 1)
                }
                setAllExpanded((prev) => !prev)
              }}
              className="rounded-lg bg-gray-100 p-2 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              title={
                allExpanded ? t('actions.collapseAll') : t('actions.expandAll')
              }
            >
              {allExpanded ? (
                <ChevronsDownUp size={16} />
              ) : (
                <ChevronsUpDown size={16} />
              )}
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowEditAsText(true)}
                className="flex items-center gap-2 rounded-lg bg-amber-400 p-2 text-sm text-gray-900 transition-colors hover:bg-amber-500 sm:px-3 sm:py-1.5 dark:bg-amber-400 dark:hover:bg-amber-500"
              >
                <FileText size={16} />
                <span className="hidden sm:inline">
                  {t('actions.editAsText')}
                </span>
              </button>
              <AddScheduleItemModal
                isOpen={showAddMenu}
                onOpenChange={setShowAddMenu}
                onAddSong={handleSongSelected}
                onAddBiblePassage={handleAddBiblePassage}
                onAddSlide={handleAddSlide}
                onAddScene={handleAddScene}
              />
            </div>
          </div>
          <div className="flex-1 overflow-hidden p-3 pt-2 lg:min-h-0 lg:p-4">
            <ScheduleItemsPanel
              scheduleId={scheduleId}
              items={items}
              isLoading={isLoading}
              onSlideClick={handleSlideClick}
              onVerseClick={handleVerseClick}
              onEntryClick={handleEntryClick}
              onAnnouncementClick={handleAnnouncementClick}
              onSceneClick={handleSceneClick}
              onReorder={handleReorder}
              onEditSong={handleEditSong}
              onNavigateToSong={handleNavigateToSong}
              onDeleteItem={handleDeleteItem}
              onEditItem={handleEditItem}
              onChangeSong={handleChangeSong}
              onEditKeyLine={handleEditKeyLine}
              onToggleSung={handleToggleSung}
              expandAllTrigger={expandAllTrigger}
              collapseAllTrigger={collapseAllTrigger}
            />
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col h-full lg:overflow-hidden overflow-auto scrollbar-thin">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 lg:mb-4 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex-1 min-w-0 mr-4 overflow-hidden group">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  className="flex-1 px-2 py-1 text-xl font-bold bg-white dark:bg-gray-900 border border-indigo-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  disabled={upsertSchedule.isPending}
                  className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                >
                  {upsertSchedule.isPending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Check size={18} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEditTitle}
                  className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={handleStartEditTitle}
              >
                <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                  {schedule.title}
                </h1>
                <Pencil
                  size={16}
                  className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                />
              </div>
            )}
          </div>
        </div>

        {/* Header action buttons - matching songs/bible design */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleLoadFromFile}
            disabled={isLoadingFile || isImporting}
            className="flex items-center gap-2 px-2 py-1.5 lg:px-3 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoadingFile || isImporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {t('actions.loadFromFile')}
            </span>
          </button>
          <button
            type="button"
            onClick={handleOpenExportModal}
            disabled={isSaving}
            className="flex items-center gap-2 px-2 py-1.5 lg:px-3 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{t('actions.saveToFile')}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            title={t('actions.delete')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {/* Panels only form movable columns on a large screen. */}
          <ActionMenu
            items={isLargeScreen ? [editLayoutAction] : []}
            label={tCommon('actionsMenu.trigger')}
            triggerIcon={<MoreHorizontal size={16} />}
            testId="schedule-presenter-actions-menu"
          />
        </div>
      </div>

      {/* Main Content - Two Panel Layout */}
      <Workspace
        id="schedule-presenter"
        panels={workspacePanels}
        defaultLayout={SCHEDULE_WORKSPACE_LAYOUT}
        defaultColumnSizes={['40%', '60%']}
        stacked={!isLargeScreen}
        className="lg:flex-1 lg:min-h-0"
      />

      {/* Song Picker Modal — only for replacing an existing song; adding a new
          one happens inside AddScheduleItemModal. */}
      <SongPickerModal
        isOpen={!!changingSongItem}
        onClose={() => setChangingSongItem(null)}
        onSongSelect={handleSongSelected}
      />

      {/* Insert Slide Modal */}
      <InsertSlideModal
        isOpen={showSlideModal || !!editingSlideItem}
        onClose={() => {
          // Reopen add menu if we were adding (not editing) a slide
          if (showSlideModal && !editingSlideItem) {
            handleReopenAddMenu()
          }
          setShowSlideModal(false)
          setEditingSlideItem(null)
        }}
        scheduleId={scheduleId}
        initialTemplate={slideTemplate}
        editingItem={
          editingSlideItem
            ? {
                id: editingSlideItem.id,
                slideType: editingSlideItem.slideType,
                slideContent: editingSlideItem.slideContent,
                verseteTineriEntries: editingSlideItem.verseteTineriEntries,
              }
            : undefined
        }
        onSaved={() => refetch()}
      />

      {/* Edit as Text Modal */}
      <EditAsTextModal
        isOpen={showEditAsText}
        onClose={() => setShowEditAsText(false)}
        scheduleId={scheduleId}
        currentItems={items}
        onItemsUpdated={() => refetch()}
      />

      {/* Bible Passage Picker Modal */}
      <BiblePassagePickerModal
        isOpen={showBiblePassagePicker || !!editingBiblePassageItem}
        onClose={() => {
          // Reopen add menu if we were adding (not editing) a Bible passage
          if (showBiblePassagePicker && !editingBiblePassageItem) {
            handleReopenAddMenu()
          }
          setShowBiblePassagePicker(false)
          setEditingBiblePassageItem(null)
        }}
        scheduleId={scheduleId}
        editingItem={
          editingBiblePassageItem
            ? {
                id: editingBiblePassageItem.id,
                biblePassageReference:
                  editingBiblePassageItem.biblePassageReference,
              }
            : undefined
        }
        onSaved={() => refetch()}
      />

      {/* Scene Picker Modal */}
      <ScenePickerModal
        isOpen={showScenePicker}
        onClose={() => {
          handleReopenAddMenu()
          setShowScenePicker(false)
        }}
        onSceneSelect={(obsSceneName) => {
          handleSceneSelect(obsSceneName)
          setShowScenePicker(false)
        }}
      />

      {/* Export Format Modal */}
      <ScheduleExportFormatModal
        isOpen={showExportFormatModal}
        onConfirm={handleExportFormatConfirm}
        onCancel={() => setShowExportFormatModal(false)}
      />

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

      {/* Song Editor Modal */}
      {editingSongId !== null && (
        <SongEditorModal
          isOpen={editingSongId !== null}
          songId={editingSongId}
          onClose={() => setEditingSongId(null)}
          onSaved={() => {
            refetch()
          }}
        />
      )}

      <KeyLineEditDialog ref={keyLineDialogRef} />
    </div>
  )
}
