import { createFileRoute } from '@tanstack/react-router'
import { Book, GripVertical, Loader2, Settings } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type {
  BibleHistoryItem,
  BibleSearchResult,
  BibleVerse,
} from '~/features/bible'
import {
  BibleControlPanel,
  BibleHistoryPanel,
  BibleNavigationPanel,
  BibleSettingsModal,
  formatVerseReference,
  getVerseByReference,
  useAddToHistory,
  useBibleKeyboardShortcuts,
  useBibleNavigation,
  useBooks,
  useSelectedBibleTranslations,
  useVerse,
  useVerses,
} from '~/features/bible'
import {
  useClearSlide,
  useNavigateTemporary,
  usePresentationState,
  usePresentTemporaryBible,
} from '~/features/presentation'
import { useQueue } from '~/features/queue'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

export const Route = createFileRoute('/bible/')({
  component: BiblePage,
})

function BiblePage() {
  const { t } = useTranslation('bible')

  const {
    selectedTranslations,
    primaryTranslation,
    secondaryTranslation,
    translations,
    isLoading: translationsLoading,
  } = useSelectedBibleTranslations()
  const presentTemporaryBible = usePresentTemporaryBible()
  const clearSlide = useClearSlide()
  const navigateTemporary = useNavigateTemporary()
  const addToHistory = useAddToHistory()

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [dividerPosition, setDividerPosition] = useState(() => {
    const stored = localStorage.getItem('bible-left-divider')
    return stored ? Number(stored) : 30
  })
  const [rightDividerPosition, setRightDividerPosition] = useState(() => {
    const stored = localStorage.getItem('bible-right-divider')
    return stored ? Number(stored) : 70
  })
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(() => {
    const stored = localStorage.getItem('bible-history-collapsed')
    return stored === 'true'
  })
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const isRightDragging = useRef(false)
  const hasNavigatedOnOpen = useRef(false)
  // Track when user is browsing away from presented verse (disables sync)
  const isBrowsingRef = useRef(false)
  // Track previous translations to detect changes for re-presentation
  const prevPrimaryTranslationIdRef = useRef<number | undefined>(undefined)
  const prevSecondaryTranslationIdRef = useRef<number | null | undefined>(
    undefined,
  )

  // Track screen size for responsive layout
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024)
    }
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])
  const prevChapterRef = useRef<{ bookId: number; chapter: number } | null>(
    null,
  )

  // Initialize navigation with primary translation
  const navigation = useBibleNavigation(primaryTranslation?.id)

  // Get presentation state and queue to sync with current Bible item
  const { data: presentationState } = usePresentationState()
  const { data: queue } = useQueue()

  // Find current Bible item in queue
  const currentBibleItem = queue?.find(
    (item) =>
      item.id === presentationState?.currentQueueItemId &&
      item.itemType === 'bible' &&
      item.bibleVerseId,
  )

  // Fetch verse details for the current Bible item
  const { data: currentVerse } = useVerse(
    currentBibleItem?.bibleVerseId ?? undefined,
  )

  // Fetch books for temporary content to get bookName
  const temporaryBibleTranslationId =
    presentationState?.temporaryContent?.type === 'bible'
      ? presentationState.temporaryContent.data.translationId
      : undefined
  const { data: temporaryBooks = [] } = useBooks(temporaryBibleTranslationId)

  // Sync navigation with current Bible verse only on initial page open
  // Only sync if the presentation content matches the primary translation
  useEffect(() => {
    if (hasNavigatedOnOpen.current) return
    // Wait for primary translation to be loaded before syncing
    if (!primaryTranslation) return

    // Priority 1: Temporary Bible content (only if it matches primary translation)
    if (presentationState?.temporaryContent?.type === 'bible') {
      const tempData = presentationState.temporaryContent.data
      // Only sync if the presentation is using the primary translation
      if (tempData.translationId !== primaryTranslation.id) {
        // Mark as navigated so we don't keep trying to sync
        hasNavigatedOnOpen.current = true
        return
      }
      const book = temporaryBooks.find((b) => b.id === tempData.bookId)
      if (book) {
        hasNavigatedOnOpen.current = true
        navigation.navigateToVerse({
          translationId: tempData.translationId,
          bookId: tempData.bookId,
          bookName: book.bookName,
          chapter: tempData.chapter,
          verseIndex: tempData.currentVerseIndex,
        })
      }
      return
    }

    // Priority 2: Queue-based Bible verse (only if it matches primary translation)
    if (currentVerse) {
      // Only sync if the verse is from the primary translation
      if (currentVerse.translationId !== primaryTranslation.id) {
        hasNavigatedOnOpen.current = true
        return
      }
      hasNavigatedOnOpen.current = true
      navigation.navigateToVerse({
        translationId: currentVerse.translationId,
        bookId: currentVerse.bookId,
        bookName: currentVerse.bookName,
        chapter: currentVerse.chapter,
        verseIndex: currentVerse.verse - 1, // verse number is 1-based, index is 0-based
      })
    }
  }, [
    presentationState,
    currentVerse,
    temporaryBooks,
    navigation,
    primaryTranslation,
  ])

  // Extract primitive values from temporary content to avoid object reference comparisons
  const tempContentType = presentationState?.temporaryContent?.type
  const tempContentData =
    tempContentType === 'bible'
      ? presentationState?.temporaryContent?.data
      : null
  const serverChapter = tempContentData?.chapter
  const serverBookId = tempContentData?.bookId
  const serverVerseIndex = tempContentData?.currentVerseIndex

  // Sync navigation when server moves to a different chapter (e.g., via navigateTemporary)
  // Only sync if the presentation content matches the primary translation
  useEffect(() => {
    // Only sync after initial navigation has happened
    if (!hasNavigatedOnOpen.current) return

    // Skip sync when user is browsing (allows navigating away from presented verse)
    if (isBrowsingRef.current) return

    // Skip sync when user is actively searching (prevents fighting with useSmartSearch)
    if (navigation.state.searchQuery) return

    // Skip sync if no primary translation yet
    if (!primaryTranslation) return

    // Skip sync if the presentation content is from a different translation
    if (
      tempContentData &&
      tempContentData.translationId !== primaryTranslation.id
    ) {
      return
    }

    if (
      tempContentType === 'bible' &&
      serverChapter !== undefined &&
      serverBookId !== undefined &&
      serverVerseIndex !== undefined
    ) {
      const book = temporaryBooks.find((b) => b.id === serverBookId)

      // Check if the server moved to a different chapter than what we're showing
      const currentChapter = navigation.state.chapter
      const currentBookId = navigation.state.bookId

      if (
        book &&
        (currentChapter !== serverChapter || currentBookId !== serverBookId)
      ) {
        // Server moved to a different chapter, sync the UI
        navigation.navigateToChapter({
          bookId: serverBookId,
          bookName: book.bookName,
          chapter: serverChapter,
          verseIndex: serverVerseIndex,
        })
      } else if (
        currentChapter === serverChapter &&
        currentBookId === serverBookId &&
        navigation.state.presentedIndex !== serverVerseIndex
      ) {
        // Same chapter but different verse, update the presented index
        navigation.presentVerse(serverVerseIndex)
      }
    }
  }, [
    tempContentType,
    tempContentData,
    serverChapter,
    serverBookId,
    serverVerseIndex,
    temporaryBooks,
    navigation,
    primaryTranslation,
  ])

  // Re-present current verse when primary or secondary translation changes
  // This updates the screen preview to show the verse in the new translation(s)
  useEffect(() => {
    const prevPrimaryId = prevPrimaryTranslationIdRef.current
    const currentPrimaryId = primaryTranslation?.id
    const prevSecondaryId = prevSecondaryTranslationIdRef.current
    const currentSecondaryId = secondaryTranslation?.id ?? null

    // Skip if no primary translation yet
    if (!primaryTranslation) return

    // Update refs for next comparison
    prevPrimaryTranslationIdRef.current = currentPrimaryId
    prevSecondaryTranslationIdRef.current = currentSecondaryId

    // Skip if this is the first time we have a translation (initial load)
    if (prevPrimaryId === undefined) {
      return
    }

    // Check if either translation changed
    const primaryChanged = prevPrimaryId !== currentPrimaryId
    const secondaryChanged =
      prevSecondaryId !== undefined && prevSecondaryId !== currentSecondaryId

    // Skip if neither translation changed
    if (!primaryChanged && !secondaryChanged) return

    // Check if there's a Bible verse currently being presented
    if (presentationState?.temporaryContent?.type !== 'bible') {
      return
    }
    if (presentationState?.isHidden) {
      return
    }

    const tempData = presentationState.temporaryContent.data

    // Re-present the current verse in the new translation(s)
    const rePresentVerse = async () => {
      try {
        let verseId: number
        let verseText: string
        let bookName: string
        let translationId: number
        let bookId: number
        let bookCode: string
        let chapter: number
        let verse: number

        // If primary changed, fetch the new primary verse
        // If only secondary changed, reuse existing primary verse data
        if (primaryChanged) {
          const newVerse = await getVerseByReference(
            primaryTranslation.id,
            tempData.bookCode,
            tempData.chapter,
            tempData.currentVerseIndex + 1, // verseIndex is 0-based, verse number is 1-based
          )

          if (!newVerse) {
            return
          }

          verseId = newVerse.id
          verseText = newVerse.text
          bookName = newVerse.bookName
          translationId = newVerse.translationId
          bookId = newVerse.bookId
          bookCode = newVerse.bookCode
          chapter = newVerse.chapter
          verse = newVerse.verse
        } else {
          verseId = tempData.verseId
          verseText = tempData.text
          bookName = tempData.bookName
          translationId = tempData.translationId
          bookId = tempData.bookId
          bookCode = tempData.bookCode
          chapter = tempData.chapter
          verse = tempData.currentVerseIndex + 1
        }

        const reference = formatVerseReference(
          bookName,
          chapter,
          verse,
          primaryTranslation.abbreviation,
        )

        // Fetch secondary verse if secondary translation is selected
        let secondaryText: string | undefined
        let secondaryBookName: string | undefined
        let secondaryTranslationAbbreviation: string | undefined

        if (secondaryTranslation) {
          const secondaryVerse = await getVerseByReference(
            secondaryTranslation.id,
            bookCode,
            chapter,
            verse,
          )
          if (secondaryVerse) {
            secondaryText = secondaryVerse.text
            secondaryBookName = secondaryVerse.bookName
            secondaryTranslationAbbreviation = secondaryTranslation.abbreviation
          }
        } else {
        }

        // Present the verse with updated translation(s)
        await presentTemporaryBible.mutateAsync({
          verseId,
          reference,
          text: verseText,
          translationAbbreviation: primaryTranslation.abbreviation,
          bookName,
          translationId,
          bookId,
          bookCode,
          chapter,
          currentVerseIndex: tempData.currentVerseIndex,
          secondaryText,
          secondaryBookName,
          secondaryTranslationAbbreviation,
        })
      } catch (_error) {}
    }

    rePresentVerse()
  }, [
    primaryTranslation,
    secondaryTranslation,
    presentationState?.temporaryContent,
    presentationState?.isHidden,
    presentTemporaryBible,
  ])

  // Get verses for the current selection
  const { data: verses = [] } = useVerses(
    navigation.state.bookId,
    navigation.state.chapter,
  )

  // Get current translation (the one being navigated)
  const currentTranslation = translations.find(
    (t) => t.id === navigation.state.translationId,
  )

  // Handle verse presentation to screen (API call)
  const presentVerseToScreen = useCallback(
    async (verse: BibleVerse, verseIndex: number) => {
      const reference = formatVerseReference(
        verse.bookName,
        verse.chapter,
        verse.verse,
        currentTranslation?.abbreviation,
      )

      // Fetch secondary verse if secondary translation is selected
      let secondaryText: string | undefined
      let secondaryBookName: string | undefined
      let secondaryTranslationAbbreviation: string | undefined

      if (secondaryTranslation) {
        const secondaryVerse = await getVerseByReference(
          secondaryTranslation.id,
          verse.bookCode,
          verse.chapter,
          verse.verse,
        )
        if (secondaryVerse) {
          secondaryText = secondaryVerse.text
          secondaryBookName = secondaryVerse.bookName
          secondaryTranslationAbbreviation = secondaryTranslation.abbreviation
        }
      }

      // Present temporarily (bypasses queue)
      await presentTemporaryBible.mutateAsync({
        verseId: verse.id,
        reference,
        text: verse.text,
        translationAbbreviation: currentTranslation?.abbreviation || '',
        bookName: verse.bookName,
        translationId: verse.translationId,
        bookId: verse.bookId,
        bookCode: verse.bookCode,
        chapter: verse.chapter,
        currentVerseIndex: verseIndex,
        secondaryText,
        secondaryBookName,
        secondaryTranslationAbbreviation,
      })

      // Add to Bible history
      addToHistory.mutate({
        verseId: verse.id,
        reference,
        text: verse.text,
        translationAbbreviation: currentTranslation?.abbreviation || '',
        bookName: verse.bookName,
        translationId: verse.translationId,
        bookId: verse.bookId,
        chapter: verse.chapter,
        verse: verse.verse,
      })
    },
    [
      currentTranslation?.abbreviation,
      secondaryTranslation,
      presentTemporaryBible,
      addToHistory,
    ],
  )

  // Auto-present verse when navigating to a new chapter (for chapter/book transitions)
  useEffect(() => {
    const { bookId, chapter, presentedIndex } = navigation.state
    if (!bookId || !chapter || verses.length === 0) return

    const prevChapter = prevChapterRef.current
    const chapterChanged =
      prevChapter &&
      (prevChapter.bookId !== bookId || prevChapter.chapter !== chapter)

    // Update ref for next comparison
    prevChapterRef.current = { bookId, chapter }

    // If chapter changed and we have a presentedIndex, present that verse
    if (chapterChanged && presentedIndex !== null) {
      // Clamp the index to valid range
      const clampedIndex = Math.min(presentedIndex, verses.length - 1)
      const verse = verses[clampedIndex]
      if (verse) {
        // Update the index if it was clamped
        if (clampedIndex !== presentedIndex) {
          navigation.presentVerse(clampedIndex)
        }
        presentVerseToScreen(verse, clampedIndex)
      }
    }
  }, [navigation, verses, presentVerseToScreen])

  // Handle verse selection - immediately present it
  const handleSelectVerse = useCallback(
    async (verse: BibleVerse, index: number) => {
      // Clear browse mode when selecting a verse (re-enables sync)
      isBrowsingRef.current = false
      // Mark as navigated so sync effect works for subsequent chapter changes
      hasNavigatedOnOpen.current = true
      navigation.presentVerse(index)
      await presentVerseToScreen(verse, index)
    },
    [navigation, presentVerseToScreen],
  )

  // Handle search result selection
  const handleSelectSearchResult = useCallback(
    async (result: BibleSearchResult) => {
      // Clear browse mode when selecting a verse (re-enables sync)
      isBrowsingRef.current = false
      // Mark as navigated so sync effect works for subsequent chapter changes
      hasNavigatedOnOpen.current = true

      const reference =
        result.reference ||
        `${result.bookName} ${result.chapter}:${result.verse}`

      // Fetch secondary verse if secondary translation is selected
      let secondaryText: string | undefined
      let secondaryBookName: string | undefined
      let secondaryTranslationAbbreviation: string | undefined

      if (secondaryTranslation) {
        const secondaryVerse = await getVerseByReference(
          secondaryTranslation.id,
          result.bookCode,
          result.chapter,
          result.verse,
        )
        if (secondaryVerse) {
          secondaryText = secondaryVerse.text
          secondaryBookName = secondaryVerse.bookName
          secondaryTranslationAbbreviation = secondaryTranslation.abbreviation
        }
      }

      // Present search result temporarily
      await presentTemporaryBible.mutateAsync({
        verseId: result.id,
        reference,
        text: result.text,
        translationAbbreviation: currentTranslation?.abbreviation || '',
        bookName: result.bookName,
        translationId: result.translationId,
        bookId: result.bookId,
        bookCode: result.bookCode,
        chapter: result.chapter,
        currentVerseIndex: result.verse - 1, // Convert 1-based verse to 0-based index
        secondaryText,
        secondaryBookName,
        secondaryTranslationAbbreviation,
      })
    },
    [
      currentTranslation?.abbreviation,
      secondaryTranslation,
      presentTemporaryBible,
    ],
  )

  // Handle next/previous verse navigation
  const handleNextVerse = useCallback(async () => {
    const { presentedIndex, searchedIndex } = navigation.state
    const currentIndex = presentedIndex ?? searchedIndex ?? -1
    const nextIndex = currentIndex + 1

    // Bounds check
    if (nextIndex >= verses.length) {
      // If presenting, navigate to next chapter
      if (presentedIndex !== null) {
        await navigateTemporary.mutateAsync({ direction: 'next' })
      }
      return
    }

    // If currently presenting, present next verse
    if (presentedIndex !== null) {
      const verse = verses[nextIndex]
      if (verse) {
        navigation.presentVerse(nextIndex)
        await presentVerseToScreen(verse, nextIndex)
      }
    } else {
      // Just move selection (not presenting)
      navigation.setSearchedIndex(nextIndex)
    }
  }, [navigation, verses, presentVerseToScreen, navigateTemporary])

  const handlePreviousVerse = useCallback(async () => {
    const { presentedIndex, searchedIndex } = navigation.state
    const currentIndex = presentedIndex ?? searchedIndex ?? 0
    const prevIndex = currentIndex - 1

    // Bounds check
    if (prevIndex < 0) {
      // If presenting, navigate to previous chapter
      if (presentedIndex !== null) {
        await navigateTemporary.mutateAsync({ direction: 'prev' })
      }
      return
    }

    // If currently presenting, present previous verse
    if (presentedIndex !== null) {
      const verse = verses[prevIndex]
      if (verse) {
        navigation.presentVerse(prevIndex)
        await presentVerseToScreen(verse, prevIndex)
      }
    } else {
      // Just move selection (not presenting)
      navigation.setSearchedIndex(prevIndex)
    }
  }, [navigation, verses, presentVerseToScreen, navigateTemporary])

  // Handle hide presentation (Escape) - clears slide but keeps selection
  const handleHidePresentation = useCallback(async () => {
    // Disable sync until user selects a new verse (prevents race with clearSlide API)
    isBrowsingRef.current = true
    navigation.clearPresentation()
    await clearSlide.mutateAsync()
  }, [navigation, clearSlide])

  // Handle presenting the searched verse (Enter) - presents the searched verse if not already presented
  const handlePresentSearched = useCallback(async () => {
    const { searchedIndex, presentedIndex } = navigation.state
    // Only present if there's a searched verse that's not already presented
    if (searchedIndex !== null && searchedIndex !== presentedIndex) {
      const verse = verses[searchedIndex]
      if (verse) {
        navigation.presentVerse(searchedIndex)
        await presentVerseToScreen(verse, searchedIndex)
      }
    }
  }, [navigation, verses, presentVerseToScreen])

  // Handle go back - sets browse mode when there's a verse being presented
  const handleGoBack = useCallback(() => {
    // If there's a verse being presented, enable browse mode to prevent sync from snapping back
    if (tempContentType === 'bible') {
      isBrowsingRef.current = true
    }
    navigation.goBack()
  }, [navigation, tempContentType])

  // Enable keyboard shortcuts
  useBibleKeyboardShortcuts({
    onNextVerse: handleNextVerse,
    onPreviousVerse: handlePreviousVerse,
    onGoBack: handleGoBack,
    onHidePresentation: handleHidePresentation,
    onPresentSearched: handlePresentSearched,
    enabled: navigation.state.level === 'verses',
  })

  const canNavigateVerses =
    navigation.state.level === 'verses' && verses.length > 0

  // Persist divider positions and collapse state to localStorage
  useEffect(() => {
    localStorage.setItem('bible-left-divider', String(dividerPosition))
  }, [dividerPosition])

  useEffect(() => {
    localStorage.setItem('bible-right-divider', String(rightDividerPosition))
  }, [rightDividerPosition])

  useEffect(() => {
    localStorage.setItem('bible-history-collapsed', String(isHistoryCollapsed))
  }, [isHistoryCollapsed])

  const handleToggleHistory = useCallback(() => {
    setIsHistoryCollapsed((prev) => !prev)
  }, [])

  // Left divider drag handlers (horizontal - between navigation and right panel)
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
      // Clamp between 20% and 80%
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

  // Right divider drag handlers (horizontal - between control panel and history)
  const handleRightDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isRightDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isRightDragging.current || !rightPanelRef.current) return
      const panelRect = rightPanelRef.current.getBoundingClientRect()
      const newPosition =
        ((moveEvent.clientX - panelRect.left) / panelRect.width) * 100
      // Clamp between 30% and 85%
      setRightDividerPosition(Math.min(85, Math.max(30, newPosition)))
    }

    const handleMouseUp = () => {
      isRightDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  return (
    <PagePermissionGuard permission="bible.view">
      <div className="flex flex-col h-full lg:overflow-hidden overflow-auto scrollbar-thin">
        <div className="flex items-center justify-between mb-3 lg:mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Book className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('title')}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-2 py-1.5 lg:px-3 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">{t('actions.settings')}</span>
          </button>
        </div>

        {translationsLoading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
          </div>
        ) : selectedTranslations.length > 0 ? (
          <div
            ref={containerRef}
            className="flex flex-col lg:flex-row lg:flex-1 lg:min-h-0 gap-3 lg:gap-1"
          >
            {/* Left Panel - Navigation (shows last on mobile) */}
            <div
              className="order-2 lg:order-1 lg:min-h-0 lg:h-full lg:flex-initial overflow-hidden"
              style={
                isLargeScreen
                  ? { width: `calc(${dividerPosition}% - 8px)` }
                  : undefined
              }
            >
              <BibleNavigationPanel
                navigation={navigation}
                onSelectVerse={handleSelectVerse}
                onSelectSearchResult={handleSelectSearchResult}
                onPresentSearched={handlePresentSearched}
                onNextVerse={handleNextVerse}
                onPreviousVerse={handlePreviousVerse}
                onGoBack={handleGoBack}
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

            {/* Right Panel - Control Panel + History (shows first on mobile) */}
            <div
              ref={rightPanelRef}
              className="order-1 lg:order-3 lg:min-h-0 lg:flex-1 overflow-hidden shrink-0 flex flex-col lg:flex-row"
              style={
                isLargeScreen
                  ? { width: `calc(${100 - dividerPosition}% - 8px)` }
                  : undefined
              }
            >
              {/* Control Panel - Left section */}
              <div
                className="overflow-hidden h-full"
                style={
                  isLargeScreen && !isHistoryCollapsed
                    ? { width: `calc(${rightDividerPosition}% - 4px)` }
                    : { flex: 1, minWidth: 0 }
                }
              >
                <BibleControlPanel
                  onPrevVerse={handlePreviousVerse}
                  onNextVerse={handleNextVerse}
                  canNavigate={canNavigateVerses}
                  onToggleHistory={handleToggleHistory}
                  isHistoryCollapsed={isHistoryCollapsed}
                />
              </div>

              {/* Vertical Divider - only show when history is visible */}
              {!isHistoryCollapsed && (
                <div
                  className="hidden lg:flex items-center justify-center w-2 cursor-col-resize hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded transition-colors group"
                  onMouseDown={handleRightDividerMouseDown}
                >
                  <GripVertical
                    size={16}
                    className="text-gray-400 group-hover:text-indigo-500 transition-colors"
                  />
                </div>
              )}

              {/* History Panel - Right section */}
              {!isHistoryCollapsed && (
                <div
                  className="overflow-hidden h-full hidden lg:block"
                  style={
                    isLargeScreen
                      ? { width: `calc(${100 - rightDividerPosition}% - 4px)` }
                      : undefined
                  }
                >
                  <BibleHistoryPanel
                    onSelectVerse={(item: BibleHistoryItem) => {
                      navigation.navigateToChapter({
                        bookId: item.bookId,
                        bookName: item.bookName,
                        chapter: item.chapter,
                        verseIndex: item.verse - 1,
                        clearSearch: true,
                      })
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : translations.length > 0 ? (
          // Translations exist but none selected - prompt to go to settings
          <div className="text-center py-12 flex-1 flex flex-col items-center justify-center">
            <Book className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {t('empty.noTranslationsSelected')}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {t('empty.noTranslationsSelectedDescription')}
            </p>
          </div>
        ) : (
          // No translations imported at all
          <div className="text-center py-12 flex-1 flex flex-col items-center justify-center">
            <Book className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {t('empty.title')}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {t('empty.description')}
            </p>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5" />
              {t('actions.openSettings')}
            </button>
          </div>
        )}

        <BibleSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </div>
    </PagePermissionGuard>
  )
}
