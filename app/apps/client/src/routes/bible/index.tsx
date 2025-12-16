import { createFileRoute } from '@tanstack/react-router'
import { Book, FileUp, GripVertical, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { BibleSearchResult, BibleVerse } from '~/features/bible'
import {
  BibleControlPanel,
  BibleNavigationPanel,
  formatVerseReference,
  useBibleKeyboardShortcuts,
  useBibleNavigation,
  useImportTranslation,
  useTranslations,
  useVerses,
} from '~/features/bible'
import {
  useClearSlide,
  useUpdatePresentationState,
} from '~/features/presentation'
import { useInsertBibleVerseToQueue } from '~/features/queue'
import { AlertModal } from '~/ui/modal'
import { PagePermissionGuard } from '~/ui/PagePermissionGuard'

export const Route = createFileRoute('/bible/')({
  component: BiblePage,
})

function BiblePage() {
  const { t } = useTranslation('bible')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: translations, isLoading: translationsLoading } =
    useTranslations()
  const { mutateAsync: importTranslation, isPending: isImporting } =
    useImportTranslation()
  const insertBibleVerse = useInsertBibleVerseToQueue()
  const updatePresentationState = useUpdatePresentationState()
  const clearSlide = useClearSlide()

  const [importError, setImportError] = useState<string | null>(null)
  const [dividerPosition, setDividerPosition] = useState(40) // percentage
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  // Initialize navigation with first translation
  const navigation = useBibleNavigation(translations?.[0]?.id)

  // Auto-select first translation when loaded
  useEffect(() => {
    if (translations?.length && !navigation.state.translationId) {
      navigation.selectTranslation(translations[0].id)
    }
  }, [translations, navigation])

  // Get verses for the current selection
  const { data: verses = [] } = useVerses(
    navigation.state.bookId,
    navigation.state.chapter,
  )

  // Get current translation abbreviation
  const currentTranslation = translations?.find(
    (t) => t.id === navigation.state.translationId,
  )

  // Handle verse presentation
  const presentVerse = useCallback(
    async (verse: BibleVerse) => {
      const reference = formatVerseReference(
        verse.bookName,
        verse.chapter,
        verse.verse,
        currentTranslation?.abbreviation,
      )

      // Insert to queue and present
      const result = await insertBibleVerse.mutateAsync({
        verseId: verse.id,
        reference,
        text: verse.text,
        translationAbbreviation: currentTranslation?.abbreviation || '',
        presentNow: true,
      })

      // Update presentation state to show this verse
      if (result.success && result.data) {
        await updatePresentationState.mutateAsync({
          currentQueueItemId: result.data.id,
          currentSongSlideId: null,
        })
      }
    },
    [
      currentTranslation?.abbreviation,
      insertBibleVerse,
      updatePresentationState,
    ],
  )

  // Handle verse selection from navigation
  const handleSelectVerse = useCallback(
    async (verse: BibleVerse, index: number) => {
      await presentVerse(verse)
    },
    [presentVerse],
  )

  // Handle search result selection
  const handleSelectSearchResult = useCallback(
    async (result: BibleSearchResult) => {
      const reference =
        result.reference ||
        `${result.bookName} ${result.chapter}:${result.verse}`

      await insertBibleVerse.mutateAsync({
        verseId: result.id,
        reference,
        text: result.text,
        translationAbbreviation: currentTranslation?.abbreviation || '',
        presentNow: true,
      })
    },
    [currentTranslation?.abbreviation, insertBibleVerse],
  )

  // Handle next/previous verse navigation
  const handleNextVerse = useCallback(async () => {
    const nextIndex = navigation.state.verseIndex + 1
    if (nextIndex < verses.length) {
      navigation.nextVerse()
      const verse = verses[nextIndex]
      if (verse) {
        await presentVerse(verse)
      }
    }
  }, [navigation, verses, presentVerse])

  const handlePreviousVerse = useCallback(async () => {
    const prevIndex = navigation.state.verseIndex - 1
    if (prevIndex >= 0) {
      navigation.previousVerse()
      const verse = verses[prevIndex]
      if (verse) {
        await presentVerse(verse)
      }
    }
  }, [navigation, verses, presentVerse])

  // Handle hide presentation
  const handleHidePresentation = useCallback(async () => {
    await clearSlide.mutateAsync()
  }, [clearSlide])

  // Handle keyboard navigation deeper
  const handleNavigateDeeper = useCallback(() => {
    // This is handled by clicking in the navigation panel
  }, [])

  // Handle present current verse
  const handlePresent = useCallback(async () => {
    const verse = verses[navigation.state.verseIndex]
    if (verse) {
      await presentVerse(verse)
    }
  }, [verses, navigation.state.verseIndex, presentVerse])

  // Enable keyboard shortcuts
  useBibleKeyboardShortcuts({
    level: navigation.state.level,
    verseIndex: navigation.state.verseIndex,
    versesCount: verses.length,
    onNextVerse: handleNextVerse,
    onPreviousVerse: handlePreviousVerse,
    onNavigateDeeper: handleNavigateDeeper,
    onGoBack: navigation.goBack,
    onHidePresentation: handleHidePresentation,
    onPresent: handlePresent,
    enabled: navigation.state.level === 'verses',
  })

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const suggestedName = file.name.replace(/\.xml$/i, '').replace(/-/g, ' ')

      await importTranslation({
        xmlContent: text,
        name: suggestedName,
        abbreviation: suggestedName.substring(0, 10).toUpperCase(),
        language: 'ro',
      })
    } catch (error) {
      setImportError(error instanceof Error ? error.message : t('import.error'))
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

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
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Book className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('title')}
            </h1>
          </div>
          <button
            type="button"
            onClick={handleImportClick}
            disabled={isImporting}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileUp className="w-4 h-4" />
            )}
            {t('actions.import')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {translationsLoading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
          </div>
        ) : translations && translations.length > 0 ? (
          <div
            ref={containerRef}
            className="flex flex-col lg:flex-row flex-1 min-h-0"
          >
            {/* Left Panel - Navigation */}
            <div
              className="min-h-0 flex-1 lg:flex-initial overflow-hidden"
              style={{ width: `${dividerPosition}%` }}
            >
              <BibleNavigationPanel
                navigation={navigation}
                translations={translations}
                isLoadingTranslations={translationsLoading}
                onSelectVerse={handleSelectVerse}
                onSelectSearchResult={handleSelectSearchResult}
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

            {/* Right Panel - Preview */}
            <div
              className="min-h-0 flex-1 overflow-hidden"
              style={{ width: `${100 - dividerPosition}%` }}
            >
              <BibleControlPanel
                onPrevVerse={handlePreviousVerse}
                onNextVerse={handleNextVerse}
                canNavigate={canNavigateVerses}
              />
            </div>
          </div>
        ) : (
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
              onClick={handleImportClick}
              disabled={isImporting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isImporting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <FileUp className="w-5 h-5" />
              )}
              {t('actions.importFirst')}
            </button>
          </div>
        )}

        <AlertModal
          isOpen={!!importError}
          title={t('import.errorTitle')}
          message={importError || ''}
          onClose={() => setImportError(null)}
          variant="error"
        />
      </div>
    </PagePermissionGuard>
  )
}
