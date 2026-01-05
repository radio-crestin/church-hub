import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Check,
  ChevronsRightLeft,
  Download,
  FileText,
  GripVertical,
  Loader2,
  Pencil,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { clearSectionLastVisited } from '~/features/navigation'
import {
  useClearTemporaryContent,
  usePresentationState,
  usePresentTemporaryAnnouncement,
  usePresentTemporaryBiblePassage,
  usePresentTemporarySong,
  usePresentTemporaryVerseteTineri,
  useWebSocket,
} from '~/features/presentation'
import {
  type ChurchProgramData,
  type ScheduleExportFormat,
  ScheduleExportFormatModal,
  useImportScheduleItems,
  useLoadScheduleFromFile,
  useSaveScheduleToFile,
} from '~/features/schedule-export'
import { SongEditorModal, SongPickerModal } from '~/features/songs/components'
import { expandSongSlidesWithChoruses } from '~/features/songs/utils/expandSongSlides'
import { useToast } from '~/ui/toast'
import { AddToScheduleMenu } from './AddToScheduleMenu'
import { BiblePassagePickerModal } from './BiblePassagePickerModal'
import { EditAsTextModal } from './EditAsTextModal'
import { InsertSlideModal } from './InsertSlideModal'
import { ScheduleItemsPanel } from './ScheduleItemsPanel'
import { SchedulePreviewPanel } from './SchedulePreviewPanel'
import {
  useDeleteSchedule,
  useReorderScheduleItems,
  useSchedule,
  useUpsertSchedule,
} from '../hooks'
import type { ScheduleItem, SlideTemplate } from '../types'

interface SchedulePresenterProps {
  scheduleId: number
  onBack: () => void
  onDeleted?: () => void
}

const DIVIDER_STORAGE_KEY = 'schedule-presenter-divider'

export function SchedulePresenter({
  scheduleId,
  onBack,
  onDeleted,
}: SchedulePresenterProps) {
  const { t } = useTranslation('schedules')
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
  const { data: presentationState } = usePresentationState()
  const presentTemporarySong = usePresentTemporarySong()
  const presentTemporaryBiblePassage = usePresentTemporaryBiblePassage()
  const presentTemporaryVerseteTineri = usePresentTemporaryVerseteTineri()
  const presentTemporaryAnnouncement = usePresentTemporaryAnnouncement()
  const clearTemporary = useClearTemporaryContent()
  const { saveSchedule, isPending: isSaving } = useSaveScheduleToFile()
  const { loadSchedule, isPending: isLoadingFile } = useLoadScheduleFromFile()
  const { importItems, isPending: isImporting } = useImportScheduleItems()
  const upsertSchedule = useUpsertSchedule()
  const deleteSchedule = useDeleteSchedule()
  const reorderItems = useReorderScheduleItems()

  // Layout state
  const [dividerPosition, setDividerPosition] = useState(() => {
    const stored = localStorage.getItem(DIVIDER_STORAGE_KEY)
    return stored ? Number(stored) : 40
  })
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Modal states
  const [showExportFormatModal, setShowExportFormatModal] = useState(false)
  const [showImportConfirmModal, setShowImportConfirmModal] = useState(false)
  const [importData, setImportData] = useState<ChurchProgramData | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSongPicker, setShowSongPicker] = useState(false)
  const [showSlideModal, setShowSlideModal] = useState(false)
  const [slideTemplate, setSlideTemplate] =
    useState<SlideTemplate>('announcement')
  const [showEditAsText, setShowEditAsText] = useState(false)
  const [showBiblePassagePicker, setShowBiblePassagePicker] = useState(false)
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
  const [expandAllTrigger, _setExpandAllTrigger] = useState(0)
  const [collapseAllTrigger, setCollapseAllTrigger] = useState(0)

  const deleteDialogRef = useRef<HTMLDialogElement>(null)
  const importDialogRef = useRef<HTMLDialogElement>(null)

  // Track screen size for responsive layout
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024)
    }
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Persist divider position
  useEffect(() => {
    localStorage.setItem(DIVIDER_STORAGE_KEY, String(dividerPosition))
  }, [dividerPosition])

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

  // Calculate flattened list of presentable items for navigation
  const flatItems = useMemo(() => {
    const result: Array<{
      item: ScheduleItem
      type: 'slide' | 'verse' | 'entry' | 'announcement'
      index: number
    }> = []

    items.forEach((item) => {
      if (item.itemType === 'song') {
        const expandedSlides = expandSongSlidesWithChoruses(item.slides)
        expandedSlides.forEach((_, idx) => {
          result.push({ item, type: 'slide', index: idx })
        })
      } else if (item.itemType === 'bible_passage') {
        item.biblePassageVerses.forEach((_, idx) => {
          result.push({ item, type: 'verse', index: idx })
        })
      } else if (item.itemType === 'slide') {
        if (item.slideType === 'versete_tineri') {
          item.verseteTineriEntries.forEach((_, idx) => {
            result.push({ item, type: 'entry', index: idx })
          })
        } else {
          result.push({ item, type: 'announcement', index: 0 })
        }
      }
    })

    return result
  }, [items])

  // Get current presentation info
  const presentedInfo = useMemo(() => {
    const temp = presentationState?.temporaryContent
    if (!temp) return null

    if (temp.type === 'song') {
      return {
        type: 'song' as const,
        songId: temp.data.songId,
        slideIndex: temp.data.currentSlideIndex,
      }
    }

    if (temp.type === 'bible_passage') {
      return {
        type: 'bible_passage' as const,
        bookName: temp.data.bookName,
        currentVerseIndex: temp.data.currentVerseIndex,
      }
    }

    if (temp.type === 'versete_tineri') {
      return {
        type: 'versete_tineri' as const,
        currentEntryIndex: temp.data.currentEntryIndex,
      }
    }

    if (temp.type === 'announcement') {
      return {
        type: 'announcement' as const,
      }
    }

    return null
  }, [presentationState?.temporaryContent])

  // Find current position in flat list
  const currentFlatIndex = useMemo(() => {
    if (!presentedInfo) return -1

    return flatItems.findIndex((fi) => {
      // Song matching
      if (fi.item.itemType === 'song' && presentedInfo.type === 'song') {
        return (
          fi.item.songId === presentedInfo.songId &&
          fi.index === presentedInfo.slideIndex
        )
      }

      // Bible passage matching
      if (
        fi.item.itemType === 'bible_passage' &&
        presentedInfo.type === 'bible_passage'
      ) {
        return fi.index === presentedInfo.currentVerseIndex
      }

      // Versete tineri matching
      if (
        fi.item.itemType === 'slide' &&
        fi.item.slideType === 'versete_tineri' &&
        presentedInfo.type === 'versete_tineri'
      ) {
        return fi.index === presentedInfo.currentEntryIndex
      }

      // Announcement matching
      if (
        fi.item.itemType === 'slide' &&
        fi.item.slideType === 'announcement' &&
        presentedInfo.type === 'announcement'
      ) {
        return true
      }

      return false
    })
  }, [flatItems, presentedInfo])

  const canNavigatePrev = currentFlatIndex > 0
  // Can navigate next if there are more slides, OR if we're on the last slide with content (to hide)
  const isOnLastSlide =
    currentFlatIndex >= 0 && currentFlatIndex === flatItems.length - 1
  const hasContent = !!presentationState?.temporaryContent
  const canNavigateNext =
    (currentFlatIndex >= 0 && currentFlatIndex < flatItems.length - 1) ||
    (isOnLastSlide && hasContent)

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

  // Handle slide click from items panel
  const handleSlideClick = useCallback(
    async (item: ScheduleItem, slideIndex: number) => {
      if (item.itemType === 'song' && item.songId) {
        await presentTemporarySong.mutateAsync({
          songId: item.songId,
          slideIndex,
        })
      }
    },
    [presentTemporarySong],
  )

  // Handle verse click (bible passage)
  const handleVerseClick = useCallback(
    async (item: ScheduleItem, verseIndex: number) => {
      if (
        item.itemType !== 'bible_passage' ||
        !item.biblePassageVerses.length
      ) {
        return
      }

      // Parse reference to extract chapter and verse info
      // Reference format: "BookName Chapter:Verse" e.g. "Genesis 1:1" or "Matei 5:3"
      const parseReference = (ref: string) => {
        const match = ref.match(/(.+?)\s+(\d+):(\d+)/)
        if (match) {
          return {
            bookName: match[1],
            chapter: Number.parseInt(match[2], 10),
            verse: Number.parseInt(match[3], 10),
          }
        }
        return { bookName: '', chapter: 1, verse: 1 }
      }

      const firstVerse = item.biblePassageVerses[0]
      const lastVerse =
        item.biblePassageVerses[item.biblePassageVerses.length - 1]
      const parsedFirst = parseReference(firstVerse.reference)
      const parsedLast = parseReference(lastVerse.reference)

      // Transform verses to presentation format
      const verses = item.biblePassageVerses.map((v) => {
        const parsed = parseReference(v.reference)
        return {
          verseId: v.verseId,
          verse: parsed.verse,
          text: v.text,
        }
      })

      await presentTemporaryBiblePassage.mutateAsync({
        translationId: 0, // Not stored in schedule, use 0
        translationAbbreviation: item.biblePassageTranslation || '',
        bookCode: '', // Not stored in schedule
        bookName: parsedFirst.bookName,
        startChapter: parsedFirst.chapter,
        startVerse: parsedFirst.verse,
        endChapter: parsedLast.chapter,
        endVerse: parsedLast.verse,
        verses,
        currentVerseIndex: verseIndex,
      })
    },
    [presentTemporaryBiblePassage],
  )

  // Handle entry click (versete tineri)
  const handleEntryClick = useCallback(
    async (item: ScheduleItem, entryIndex: number) => {
      if (
        item.itemType !== 'slide' ||
        item.slideType !== 'versete_tineri' ||
        !item.verseteTineriEntries.length
      ) {
        return
      }

      // Transform entries to presentation format
      const entries = item.verseteTineriEntries.map((e) => ({
        id: e.id,
        personName: e.personName,
        reference: e.reference,
        bookCode: e.bookCode,
        bookName: e.bookName,
        startChapter: e.startChapter,
        startVerse: e.startVerse,
        endChapter: e.endChapter,
        endVerse: e.endVerse,
        text: e.text,
        sortOrder: e.sortOrder,
      }))

      await presentTemporaryVerseteTineri.mutateAsync({
        entries,
        currentEntryIndex: entryIndex,
      })
    },
    [presentTemporaryVerseteTineri],
  )

  // Handle announcement click
  const handleAnnouncementClick = useCallback(
    async (item: ScheduleItem) => {
      if (
        item.itemType !== 'slide' ||
        item.slideType !== 'announcement' ||
        !item.slideContent
      ) {
        return
      }

      await presentTemporaryAnnouncement.mutateAsync({
        content: item.slideContent,
      })
    },
    [presentTemporaryAnnouncement],
  )

  // Helper to navigate to a specific flat item
  const navigateToFlatItem = useCallback(
    async (flatItem: (typeof flatItems)[0]) => {
      const { item, index } = flatItem

      if (item.itemType === 'song' && item.songId) {
        await presentTemporarySong.mutateAsync({
          songId: item.songId,
          slideIndex: index,
        })
      } else if (item.itemType === 'bible_passage') {
        await handleVerseClick(item, index)
      } else if (
        item.itemType === 'slide' &&
        item.slideType === 'versete_tineri'
      ) {
        await handleEntryClick(item, index)
      } else if (
        item.itemType === 'slide' &&
        item.slideType === 'announcement'
      ) {
        await handleAnnouncementClick(item)
      }
    },
    [
      presentTemporarySong,
      handleVerseClick,
      handleEntryClick,
      handleAnnouncementClick,
    ],
  )

  // Navigation handlers - support all slide types
  const handlePrevSlide = useCallback(async () => {
    if (currentFlatIndex <= 0) {
      return
    }

    const prevItem = flatItems[currentFlatIndex - 1]
    await navigateToFlatItem(prevItem)
  }, [currentFlatIndex, flatItems, navigateToFlatItem])

  const handleNextSlide = useCallback(async () => {
    // If nothing is presented, start with first item
    if (currentFlatIndex < 0) {
      if (flatItems.length > 0) {
        await navigateToFlatItem(flatItems[0])
      }
      return
    }

    // If on the last slide, hide the presentation
    if (currentFlatIndex >= flatItems.length - 1) {
      if (presentationState?.temporaryContent) {
        await clearTemporary.mutateAsync()
      }
      return
    }

    const nextItem = flatItems[currentFlatIndex + 1]
    await navigateToFlatItem(nextItem)
  }, [
    currentFlatIndex,
    flatItems,
    navigateToFlatItem,
    presentationState?.temporaryContent,
    clearTemporary,
  ])

  // Keyboard shortcuts for schedule navigation
  // We stopPropagation to prevent the global useKeyboardShortcuts from also firing
  // which uses navigateTemporary (only knows about current song, not schedule context)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if focus is on an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      // Handle navigation keys - stop propagation to prevent global handler
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.stopPropagation()
        e.preventDefault()
        if (canNavigatePrev) {
          handlePrevSlide()
        }
      } else if (
        e.key === 'ArrowRight' ||
        e.key === 'ArrowDown' ||
        e.key === ' ' ||
        e.key === 'PageDown'
      ) {
        e.stopPropagation()
        e.preventDefault()
        if (canNavigateNext) {
          handleNextSlide()
        }
      } else if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        clearTemporary.mutate()
      }
    }

    // Use capture phase to handle events before they reach the global handler
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [
    canNavigatePrev,
    canNavigateNext,
    clearTemporary,
    handlePrevSlide,
    handleNextSlide,
  ])

  // Edit handlers - these are called from AddToScheduleMenu, which closes automatically
  const handleAddSong = useCallback(() => {
    setShowSongPicker(true)
  }, [])

  const handleAddSlide = useCallback((template: SlideTemplate) => {
    setSlideTemplate(template)
    setShowSlideModal(true)
  }, [])

  const handleAddBiblePassage = useCallback(() => {
    setShowBiblePassagePicker(true)
  }, [])

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
        const { removeItemFromSchedule, addItemToSchedule } = await import(
          '../service/schedules'
        )

        // Find the item that comes before the one being replaced
        const currentIndex = items.findIndex(
          (item) => item.id === changingSongItem.id,
        )
        const previousItem = currentIndex > 0 ? items[currentIndex - 1] : null

        // Remove old song first
        const removeSuccess = await removeItemFromSchedule(
          scheduleId,
          changingSongItem.id,
        )
        if (removeSuccess) {
          // Add new song at the same position (after the previous item, or at start if first)
          const result = await addItemToSchedule(scheduleId, {
            songId,
            afterItemId: previousItem?.id,
          })
          if (result.success) {
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
      onBack()
    } else {
      showToast(t('messages.error'), 'error')
    }
  }, [scheduleId, deleteSchedule, showToast, t, onDeleted, onBack])

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
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const newPosition =
        ((moveEvent.clientX - containerRect.left) / containerRect.width) * 100
      setDividerPosition(Math.min(80, Math.max(20, newPosition)))
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  if (isLoading || !schedule) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

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
        </div>
      </div>

      {/* Main Content - Two Panel Layout */}
      <div
        ref={containerRef}
        className="flex flex-col lg:flex-row lg:flex-1 lg:min-h-0 gap-3 lg:gap-1"
      >
        {/* Left Panel - Schedule Items List */}
        <div
          className="order-2 lg:order-1 lg:min-h-0 lg:h-full lg:flex-initial overflow-hidden flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          style={
            isLargeScreen
              ? { width: `calc(${dividerPosition}% - 8px)` }
              : undefined
          }
        >
          {/* Left Panel Header */}
          <div className="flex items-center justify-between p-3 lg:p-4 pb-2 border-b border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setCollapseAllTrigger((prev) => prev + 1)}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
              title={t('actions.collapseAll')}
            >
              <ChevronsRightLeft size={16} />
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowEditAsText(true)}
                className="flex items-center gap-2 p-2 sm:px-3 sm:py-1.5 text-sm text-gray-900 bg-amber-400 hover:bg-amber-500 dark:bg-amber-400 dark:hover:bg-amber-500 rounded-lg transition-colors"
              >
                <FileText size={16} />
                <span className="hidden sm:inline">
                  {t('actions.editAsText')}
                </span>
              </button>
              <AddToScheduleMenu
                isOpen={showAddMenu}
                onOpenChange={setShowAddMenu}
                onAddSong={handleAddSong}
                onAddBiblePassage={handleAddBiblePassage}
                onAddSlide={handleAddSlide}
              />
            </div>
          </div>
          {/* Left Panel Content */}
          <div className="flex-1 overflow-hidden p-3 lg:p-4 pt-2">
            <ScheduleItemsPanel
              items={items}
              isLoading={isLoading}
              onSlideClick={handleSlideClick}
              onVerseClick={handleVerseClick}
              onEntryClick={handleEntryClick}
              onAnnouncementClick={handleAnnouncementClick}
              onReorder={handleReorder}
              onEditSong={handleEditSong}
              onNavigateToSong={handleNavigateToSong}
              onDeleteItem={handleDeleteItem}
              onEditItem={handleEditItem}
              onChangeSong={handleChangeSong}
              expandAllTrigger={expandAllTrigger}
              collapseAllTrigger={collapseAllTrigger}
            />
          </div>
        </div>

        {/* Draggable Divider */}
        <div
          className="hidden lg:flex lg:order-2 items-center justify-center w-2 cursor-col-resize hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded transition-colors group"
          onMouseDown={handleDividerMouseDown}
        >
          <GripVertical
            size={16}
            className="text-gray-400 group-hover:text-indigo-500 transition-colors"
          />
        </div>

        {/* Right Panel - Preview */}
        <div
          className="order-1 lg:order-3 lg:min-h-0 lg:flex-1 overflow-hidden shrink-0"
          style={
            isLargeScreen
              ? { width: `calc(${100 - dividerPosition}% - 8px)` }
              : undefined
          }
        >
          <SchedulePreviewPanel
            canNavigatePrev={canNavigatePrev}
            canNavigateNext={canNavigateNext || currentFlatIndex < 0}
            onPrevSlide={handlePrevSlide}
            onNextSlide={handleNextSlide}
          />
        </div>
      </div>

      {/* Song Picker Modal */}
      <SongPickerModal
        isOpen={showSongPicker || !!changingSongItem}
        onClose={() => {
          // Reopen add menu if we were adding (not changing) a song
          if (showSongPicker && !changingSongItem) {
            handleReopenAddMenu()
          }
          setShowSongPicker(false)
          setChangingSongItem(null)
        }}
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
    </div>
  )
}
