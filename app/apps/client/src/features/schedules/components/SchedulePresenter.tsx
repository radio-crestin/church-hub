import {
  ArrowLeft,
  Download,
  GripVertical,
  Loader2,
  Pencil,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  useClearTemporaryContent,
  useNavigateTemporary,
  usePresentationState,
  usePresentTemporarySong,
  useWebSocket,
} from '~/features/presentation'
import {
  type ScheduleExportFormat,
  ScheduleExportFormatModal,
  useSaveScheduleToFile,
} from '~/features/schedule-export'
import { expandSongSlidesWithChoruses } from '~/features/songs/utils/expandSongSlides'
import { useToast } from '~/ui/toast'
import { ScheduleItemsPanel } from './ScheduleItemsPanel'
import { SchedulePreviewPanel } from './SchedulePreviewPanel'
import { useSchedule } from '../hooks'
import type { ScheduleItem } from '../types'

interface SchedulePresenterProps {
  scheduleId: number
  onBack: () => void
  onEdit: () => void
}

const DIVIDER_STORAGE_KEY = 'schedule-presenter-divider'

export function SchedulePresenter({
  scheduleId,
  onBack,
  onEdit,
}: SchedulePresenterProps) {
  const { t } = useTranslation('schedules')
  const { showToast } = useToast()

  // Connect to WebSocket for real-time updates
  useWebSocket()

  const { data: schedule, isLoading } = useSchedule(scheduleId)
  const { data: presentationState } = usePresentationState()
  const presentTemporarySong = usePresentTemporarySong()
  const navigateTemporary = useNavigateTemporary()
  const clearTemporary = useClearTemporaryContent()
  const { saveSchedule, isPending: isSaving } = useSaveScheduleToFile()

  // Layout state
  const [dividerPosition, setDividerPosition] = useState(() => {
    const stored = localStorage.getItem(DIVIDER_STORAGE_KEY)
    return stored ? Number(stored) : 40
  })
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const [showExportFormatModal, setShowExportFormatModal] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

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

    return null
  }, [presentationState?.temporaryContent])

  // Find current position in flat list
  const currentFlatIndex = useMemo(() => {
    if (!presentedInfo) return -1

    return flatItems.findIndex((fi) => {
      if (fi.item.itemType === 'song' && presentedInfo.type === 'song') {
        return (
          fi.item.songId === presentedInfo.songId &&
          fi.index === presentedInfo.slideIndex
        )
      }
      return false
    })
  }, [flatItems, presentedInfo])

  const canNavigatePrev = currentFlatIndex > 0
  const canNavigateNext =
    currentFlatIndex >= 0 && currentFlatIndex < flatItems.length - 1

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if focus is on an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      if (e.key === 'ArrowLeft' && canNavigatePrev) {
        handlePrevSlide()
      } else if (e.key === 'ArrowRight' && canNavigateNext) {
        handleNextSlide()
      } else if (e.key === 'Escape') {
        clearTemporary.mutate()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canNavigatePrev, canNavigateNext, clearTemporary])

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
    async (_item: ScheduleItem, _verseIndex: number) => {
      // TODO: Implement presentTemporaryBiblePassage
      showToast('Bible passage presentation coming soon', 'info')
    },
    [showToast],
  )

  // Handle entry click (versete tineri)
  const handleEntryClick = useCallback(
    async (_item: ScheduleItem, _entryIndex: number) => {
      // TODO: Implement presentTemporaryVerseteTineri
      showToast('Versete Tineri presentation coming soon', 'info')
    },
    [showToast],
  )

  // Handle announcement click
  const handleAnnouncementClick = useCallback(
    async (_item: ScheduleItem) => {
      // TODO: Implement presentTemporarySlide
      showToast('Announcement presentation coming soon', 'info')
    },
    [showToast],
  )

  // Navigation handlers with auto-advance
  const handlePrevSlide = useCallback(async () => {
    if (currentFlatIndex <= 0) return

    const prevItem = flatItems[currentFlatIndex - 1]
    if (prevItem.item.itemType === 'song' && prevItem.item.songId) {
      await presentTemporarySong.mutateAsync({
        songId: prevItem.item.songId,
        slideIndex: prevItem.index,
      })
    }
    // TODO: Handle other item types
  }, [currentFlatIndex, flatItems, presentTemporarySong])

  const handleNextSlide = useCallback(async () => {
    // If nothing is presented yet, start from first
    if (currentFlatIndex < 0) {
      if (flatItems.length > 0) {
        const firstItem = flatItems[0]
        if (firstItem.item.itemType === 'song' && firstItem.item.songId) {
          await presentTemporarySong.mutateAsync({
            songId: firstItem.item.songId,
            slideIndex: firstItem.index,
          })
        }
      }
      return
    }

    // Try to navigate within temporary content first
    if (presentationState?.temporaryContent) {
      try {
        await navigateTemporary.mutateAsync({ direction: 'next' })
        return
      } catch {
        // Navigation failed (probably at end of item), move to next item
      }
    }

    // Move to next item in schedule
    if (currentFlatIndex >= flatItems.length - 1) return

    const nextItem = flatItems[currentFlatIndex + 1]
    if (nextItem.item.itemType === 'song' && nextItem.item.songId) {
      await presentTemporarySong.mutateAsync({
        songId: nextItem.item.songId,
        slideIndex: nextItem.index,
      })
    }
    // TODO: Handle other item types
  }, [
    currentFlatIndex,
    flatItems,
    presentTemporarySong,
    navigateTemporary,
    presentationState?.temporaryContent,
  ])

  const handleGoBack = useCallback(() => {
    onBack()
  }, [onBack])

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3 lg:mb-4 flex-shrink-0">
        <div className="flex items-center gap-3 lg:gap-4 min-w-0 flex-1">
          <button
            type="button"
            onClick={handleGoBack}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white truncate">
              {schedule.title}
            </h1>
            {schedule.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {schedule.description}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 justify-end shrink-0">
          <button
            type="button"
            onClick={handleOpenExportModal}
            disabled={isSaving}
            className="p-2 sm:px-4 sm:py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            title={t('actions.saveToFile')}
          >
            <Download size={20} />
            <span className="hidden sm:inline">{t('actions.saveToFile')}</span>
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="p-2 sm:px-4 sm:py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors inline-flex items-center gap-2"
            title={t('presenter.edit')}
          >
            <Pencil size={16} />
            <span className="hidden sm:inline">{t('presenter.edit')}</span>
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
          className="order-2 lg:order-1 lg:min-h-0 lg:h-full lg:flex-initial overflow-hidden bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 lg:p-4"
          style={
            isLargeScreen
              ? { width: `calc(${dividerPosition}% - 8px)` }
              : undefined
          }
        >
          <ScheduleItemsPanel
            items={items}
            isLoading={isLoading}
            onSlideClick={handleSlideClick}
            onVerseClick={handleVerseClick}
            onEntryClick={handleEntryClick}
            onAnnouncementClick={handleAnnouncementClick}
          />
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

      {/* Export Format Modal */}
      <ScheduleExportFormatModal
        isOpen={showExportFormatModal}
        onConfirm={handleExportFormatConfirm}
        onCancel={() => setShowExportFormatModal(false)}
      />
    </div>
  )
}
