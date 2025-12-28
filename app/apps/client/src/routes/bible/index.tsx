import { createFileRoute } from '@tanstack/react-router'
import { Book, GripVertical, Loader2, Settings } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { BibleSearchResult, BibleVerse } from '~/features/bible'
import {
  BibleControlPanel,
  BibleNavigationPanel,
  BibleSettingsModal,
  formatVerseReference,
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
    translations,
    isLoading: translationsLoading,
  } = useSelectedBibleTranslations()
  const presentTemporaryBible = usePresentTemporaryBible()
  const clearSlide = useClearSlide()
  const navigateTemporary = useNavigateTemporary()

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [dividerPosition, setDividerPosition] = useState(40) // percentage
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const hasNavigatedOnOpen = useRef(false)

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

  // Auto-select primary translation when loaded
  useEffect(() => {
    if (primaryTranslation && !navigation.state.translationId) {
      navigation.selectTranslation(primaryTranslation.id)
    }
  }, [primaryTranslation, navigation])

  // Sync navigation with current Bible verse only on initial page open
  useEffect(() => {
    if (hasNavigatedOnOpen.current) return

    // Priority 1: Temporary Bible content
    if (presentationState?.temporaryContent?.type === 'bible') {
      const tempData = presentationState.temporaryContent.data
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

    // Priority 2: Queue-based Bible verse
    if (currentVerse) {
      hasNavigatedOnOpen.current = true
      navigation.navigateToVerse({
        translationId: currentVerse.translationId,
        bookId: currentVerse.bookId,
        bookName: currentVerse.bookName,
        chapter: currentVerse.chapter,
        verseIndex: currentVerse.verse - 1, // verse number is 1-based, index is 0-based
      })
    }
  }, [presentationState, currentVerse, temporaryBooks, navigation])

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
  useEffect(() => {
    // Only sync after initial navigation has happened
    if (!hasNavigatedOnOpen.current) return

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
    serverChapter,
    serverBookId,
    serverVerseIndex,
    temporaryBooks,
    navigation,
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

      // Present temporarily (bypasses queue)
      await presentTemporaryBible.mutateAsync({
        verseId: verse.id,
        reference,
        text: verse.text,
        translationAbbreviation: currentTranslation?.abbreviation || '',
        translationId: verse.translationId,
        bookId: verse.bookId,
        bookCode: verse.bookCode,
        chapter: verse.chapter,
        currentVerseIndex: verseIndex,
      })
    },
    [currentTranslation?.abbreviation, presentTemporaryBible],
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
      // Mark as navigated so sync effect works for subsequent chapter changes
      hasNavigatedOnOpen.current = true

      const reference =
        result.reference ||
        `${result.bookName} ${result.chapter}:${result.verse}`

      // Present search result temporarily
      await presentTemporaryBible.mutateAsync({
        verseId: result.id,
        reference,
        text: result.text,
        translationAbbreviation: currentTranslation?.abbreviation || '',
        translationId: result.translationId,
        bookId: result.bookId,
        bookCode: result.bookCode,
        chapter: result.chapter,
        currentVerseIndex: result.verse - 1, // Convert 1-based verse to 0-based index
      })
    },
    [currentTranslation?.abbreviation, presentTemporaryBible],
  )

  // Handle next/previous verse navigation - server-driven to avoid double animations
  const handleNextVerse = useCallback(async () => {
    const currentIndex =
      navigation.state.presentedIndex ?? navigation.state.searchedIndex ?? -1
    const nextIndex = currentIndex + 1

    // If there are more verses in current chapter, present it
    if (nextIndex < verses.length) {
      const verse = verses[nextIndex]
      if (verse) {
        await presentVerseToScreen(verse, nextIndex)
      }
      return
    }

    // End of chapter - use server-side navigation to move to next chapter
    await navigateTemporary.mutateAsync({ direction: 'next' })
  }, [navigation.state, verses, presentVerseToScreen, navigateTemporary])

  const handlePreviousVerse = useCallback(async () => {
    const currentIndex =
      navigation.state.presentedIndex ?? navigation.state.searchedIndex ?? 0
    const prevIndex = currentIndex - 1

    // If there are previous verses in current chapter, present it
    if (prevIndex >= 0) {
      const verse = verses[prevIndex]
      if (verse) {
        await presentVerseToScreen(verse, prevIndex)
      }
      return
    }

    // Start of chapter - use server-side navigation to move to previous chapter
    await navigateTemporary.mutateAsync({ direction: 'prev' })
  }, [navigation.state, verses, presentVerseToScreen, navigateTemporary])

  // Handle hide presentation (Escape) - clears slide but keeps selection
  const handleHidePresentation = useCallback(async () => {
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

  // Enable keyboard shortcuts
  useBibleKeyboardShortcuts({
    onNextVerse: handleNextVerse,
    onPreviousVerse: handlePreviousVerse,
    onGoBack: navigation.goBack,
    onHidePresentation: handleHidePresentation,
    onPresentSearched: handlePresentSearched,
    enabled: navigation.state.level === 'verses',
  })

  const canNavigateVerses =
    navigation.state.level === 'verses' && verses.length > 0

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
            className="flex flex-col lg:flex-row lg:flex-1 lg:min-h-0 gap-3 lg:gap-0"
          >
            {/* Left Panel - Navigation (shows last on mobile) */}
            <div
              className="order-3 lg:order-1 lg:min-h-0 lg:h-full lg:flex-initial overflow-hidden"
              style={
                isLargeScreen ? { width: `${dividerPosition}%` } : undefined
              }
            >
              <BibleNavigationPanel
                navigation={navigation}
                onSelectVerse={handleSelectVerse}
                onSelectSearchResult={handleSelectSearchResult}
                onPresentSearched={handlePresentSearched}
              />
            </div>

            {/* Draggable Divider */}
            <div
              className="hidden lg:flex items-center justify-center w-2 cursor-col-resize hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors group"
              onMouseDown={handleDividerMouseDown}
            >
              <GripVertical
                size={16}
                className="text-gray-400 group-hover:text-indigo-500 transition-colors"
              />
            </div>

            {/* Right Panel - Control Panel with Preview (shows first on mobile) */}
            <div
              className="order-1 lg:order-2 lg:min-h-0 lg:flex-1 overflow-hidden"
              style={
                isLargeScreen
                  ? { width: `${100 - dividerPosition}%` }
                  : undefined
              }
            >
              <BibleControlPanel
                onPrevVerse={handlePreviousVerse}
                onNextVerse={handleNextVerse}
                canNavigate={canNavigateVerses}
              />
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
