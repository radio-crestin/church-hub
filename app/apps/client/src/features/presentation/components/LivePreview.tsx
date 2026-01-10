import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getApiUrl, isMobile } from '~/config'
import { useLocalizedBookNames } from '~/features/bible/hooks'
import { getStoredUserToken } from '~/service/api-url'
import { calculateMaxExitAnimationDuration } from './rendering/utils/styleUtils'
import { ScreenPreview } from './ScreenPreview'
import { TextStyleContextMenu } from './TextStyleContextMenu'
import { usePresentationState } from '../hooks'
import { useScreen } from '../hooks/useScreen'
import { useScreens } from '../hooks/useScreens'
import {
  useAddSlideHighlight,
  useRemoveSlideHighlight,
  useSlideHighlights,
} from '../hooks/useSlideHighlights'
import { useTextSelection } from '../hooks/useTextSelection'
import type { ContentType, TextStyleRange } from '../types'
import { addAminToLastSlide } from '../utils/addAminToLastSlide'

// Extra buffer time after animation completes before transitioning to empty state (ms)
const EXIT_ANIMATION_BUFFER = 100

// Check if we're running in Tauri context
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// Use Tauri fetch on mobile (iOS WKWebView blocks HTTP fetch)
const fetchFn = isTauri && isMobile() ? tauriFetch : window.fetch.bind(window)

// Get headers with auth token for mobile
function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Cache-Control': 'no-cache',
  }
  if (isMobile()) {
    const userToken = getStoredUserToken()
    if (userToken) {
      headers['Cookie'] = `user_auth=${userToken}`
    }
  }
  return headers
}

interface SongSlideData {
  id: number
  content: string
}

interface QueueItem {
  id: number
  itemType: string
  slideType?: string
  slideContent?: string
  bibleReference?: string
  bibleText?: string
  bibleTranslation?: string
  biblePassageVerses?: Array<{ id: number; reference: string; text: string }>
  biblePassageTranslation?: string
  verseteTineriEntries?: Array<{
    id: number
    reference: string
    text: string
    person?: string
  }>
  slides?: Array<{ id: number; content: string }>
}

interface ContentData {
  mainText?: string
  referenceText?: string
  contentText?: string
  personLabel?: string
  secondaryContentText?: string
}

// Default highlight color
const DEFAULT_HIGHLIGHT_COLOR = '#FFFF00'

// Stable empty array to prevent unnecessary re-renders when no highlights exist
const EMPTY_STYLE_RANGES: TextStyleRange[] = []

export function LivePreview() {
  // Note: WebSocket connection is established by parent ControlRoom component
  // Don't call useWebSocket() here as it causes re-renders from debug info state updates

  const { data: presentationState } = usePresentationState()
  const { data: screens } = useScreens()
  const { getBookName } = useLocalizedBookNames()

  // Highlight hooks
  const { data: slideHighlights } = useSlideHighlights()
  const addHighlight = useAddSlideHighlight()
  const removeHighlight = useRemoveSlideHighlight()

  // Ref for text selection tracking
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const { getSelectedRange, hasSelection, clearSelection } =
    useTextSelection(previewContainerRef)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    clickedHighlightId?: string
  }>({ visible: false, x: 0, y: 0 })

  // Find first primary screen (regardless of window open state)
  const primaryScreen = useMemo(() => {
    if (!screens) return null
    return (
      screens
        .filter((s) => s.type === 'primary')
        .sort((a, b) => a.sortOrder - b.sortOrder)[0] || null
    )
  }, [screens])

  // Get full config for the primary screen (use undefined if no primary screen exists)
  const { data: screen } = useScreen(primaryScreen?.id ?? undefined)

  const [contentType, setContentType] = useState<ContentType>('empty')
  const [contentData, setContentData] = useState<ContentData>({})
  const [isExitAnimating, setIsExitAnimating] = useState(false)
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevHiddenRef = useRef(presentationState?.isHidden)
  const currentContentTypeRef = useRef<ContentType>(contentType)

  // Keep track of current content type for exit animation calculation
  if (contentType !== 'empty') {
    currentContentTypeRef.current = contentType
  }

  // Handle exit animation timing - delay empty state transition
  useEffect(() => {
    const wasHidden = prevHiddenRef.current
    const isHidden = presentationState?.isHidden

    // Detect transition from visible to hidden
    if (!wasHidden && isHidden) {
      // Clear any existing timeout
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current)
      }

      // Start exit animation
      setIsExitAnimating(true)

      // Calculate the max exit animation duration from the current content type's config
      const currentConfig =
        screen?.contentConfigs[currentContentTypeRef.current]
      const animationDuration = calculateMaxExitAnimationDuration(currentConfig)
      const totalDelay = animationDuration + EXIT_ANIMATION_BUFFER

      // After animation duration + buffer, transition to empty state
      exitTimeoutRef.current = setTimeout(() => {
        setContentData({})
        setContentType('empty')
        setIsExitAnimating(false)
      }, totalDelay)
    }

    // If becoming visible, cancel any pending exit transition
    if (wasHidden && !isHidden) {
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current)
        exitTimeoutRef.current = null
      }
      setIsExitAnimating(false)
    }

    prevHiddenRef.current = isHidden

    return () => {
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current)
      }
    }
  }, [presentationState?.isHidden, screen])

  // Fetch content based on presentation state
  useEffect(() => {
    const fetchContent = async () => {
      if (!presentationState) {
        setContentData({})
        setContentType('empty')
        return
      }

      // When hidden or exit animating, don't fetch new content
      // The exit animation effect will handle transitioning to empty state
      if (presentationState.isHidden || isExitAnimating) {
        return
      }

      // Check for temporary content first (bypasses queue)
      if (presentationState.temporaryContent) {
        const temp = presentationState.temporaryContent

        if (temp.type === 'bible') {
          const data = temp.data
          const hasSecondary = Boolean(
            data.secondaryText && data.secondaryBookName,
          )

          // Build reference using localized book name
          // First extract chapter:verse from the existing reference
          const chapterVerseMatch = data.reference.match(/(\d+:\d+)/)
          const chapterVerse = chapterVerseMatch?.[1] || ''

          // Use localized book name if available
          const localizedBookName = getBookName(data.bookCode) || data.bookName

          let referenceText: string
          if (hasSecondary && data.secondaryBookName) {
            referenceText = `${localizedBookName} ${chapterVerse}`
          } else {
            // Use localized bookName + chapter:verse
            referenceText = `${localizedBookName} ${chapterVerse}`
          }

          // Combine primary + secondary text with empty line
          let contentText = data.text
          if (hasSecondary && data.secondaryText) {
            contentText = `${data.text}\n\n${data.secondaryText}`
          }

          setContentType('bible')
          setContentData({
            referenceText,
            contentText,
            secondaryContentText: data.secondaryText,
          })
          return
        }

        if (temp.type === 'song') {
          const currentSlide = temp.data.slides[temp.data.currentSlideIndex]
          if (currentSlide) {
            const isLastSlide =
              temp.data.currentSlideIndex === temp.data.slides.length - 1
            setContentType('song')
            setContentData({
              mainText: addAminToLastSlide(currentSlide.content, isLastSlide),
            })
            return
          }
        }

        if (temp.type === 'announcement') {
          setContentType('announcement')
          setContentData({
            mainText: temp.data.content,
          })
          return
        }

        if (temp.type === 'bible_passage') {
          const currentVerse = temp.data.verses[temp.data.currentVerseIndex]
          if (currentVerse) {
            // Build reference: "BookName Chapter:Verse"
            const reference = `${temp.data.bookName} ${temp.data.startChapter}:${currentVerse.verse}`
            setContentType('bible_passage')
            setContentData({
              referenceText: reference,
              contentText: currentVerse.text,
            })
            return
          }
        }

        if (temp.type === 'versete_tineri') {
          const currentEntry = temp.data.entries[temp.data.currentEntryIndex]
          if (currentEntry) {
            setContentType('versete_tineri')
            setContentData({
              personLabel: currentEntry.personName,
              referenceText: currentEntry.reference,
              contentText: currentEntry.text,
            })
            return
          }
        }

        if (temp.type === 'screen_share') {
          setContentType('screen_share')
          setContentData({})
          return
        }
      }

      try {
        const queueResponse = await fetchFn(`${getApiUrl()}/api/queue`, {
          cache: 'no-store',
          headers: getHeaders(),
          credentials: 'include',
        })

        if (!queueResponse.ok) {
          setContentData({})
          setContentType('empty')
          return
        }

        const queueResult = await queueResponse.json()
        const queueItems: QueueItem[] = queueResult.data || []

        // Find current content - song slide
        if (presentationState.currentSongSlideId) {
          for (const item of queueItems) {
            const slideIndex = item.slides?.findIndex(
              (s: SongSlideData) =>
                s.id === presentationState.currentSongSlideId,
            )
            if (slideIndex !== undefined && slideIndex !== -1 && item.slides) {
              const slide = item.slides[slideIndex]
              const isLastSlide = slideIndex === item.slides.length - 1
              setContentType('song')
              setContentData({
                mainText: addAminToLastSlide(slide.content, isLastSlide),
              })
              return
            }
          }
        }

        // Queue item content (not song slide)
        if (
          presentationState.currentQueueItemId &&
          !presentationState.currentSongSlideId
        ) {
          const queueItem = queueItems.find(
            (item) => item.id === presentationState.currentQueueItemId,
          )

          if (queueItem) {
            if (queueItem.itemType === 'slide') {
              if (
                queueItem.slideType === 'versete_tineri' &&
                queueItem.verseteTineriEntries
              ) {
                const entryId = presentationState.currentVerseteTineriEntryId
                const entry = entryId
                  ? queueItem.verseteTineriEntries.find((e) => e.id === entryId)
                  : queueItem.verseteTineriEntries[0]

                if (entry) {
                  setContentType('versete_tineri')
                  setContentData({
                    personLabel: entry.person || '',
                    referenceText: entry.reference,
                    contentText: entry.text,
                  })
                  return
                }
              }

              // Regular announcement slide
              setContentType('announcement')
              setContentData({
                mainText: queueItem.slideContent || '',
              })
              return
            }

            if (queueItem.itemType === 'bible') {
              const reference = (queueItem.bibleReference || '').replace(
                /\s*-\s*[A-Z]+\s*$/,
                '',
              )
              setContentType('bible')
              setContentData({
                referenceText: reference,
                contentText: queueItem.bibleText || '',
              })
              return
            }

            if (queueItem.itemType === 'bible_passage') {
              const verseId = presentationState.currentBiblePassageVerseId
              const verse = verseId
                ? queueItem.biblePassageVerses?.find((v) => v.id === verseId)
                : queueItem.biblePassageVerses?.[0]

              if (verse) {
                setContentType('bible_passage')
                setContentData({
                  referenceText: verse.reference,
                  contentText: verse.text,
                })
                return
              }
            }
          }
        }

        // No content, show empty/clock
        setContentData({})
        setContentType('empty')
      } catch (_error) {
        setContentData({})
        setContentType('empty')
      }
    }

    fetchContent()
  }, [
    presentationState?.currentSongSlideId,
    presentationState?.currentQueueItemId,
    presentationState?.currentBiblePassageVerseId,
    presentationState?.currentVerseteTineriEntryId,
    presentationState?.isHidden,
    presentationState?.updatedAt,
    // Include temporaryContent to ensure re-render when navigating temporary songs/bible
    presentationState?.temporaryContent,
    isExitAnimating,
  ])

  const hasContent = Object.keys(contentData).length > 0

  // Visibility is false when hidden or during exit animation (triggers exit animation in ScreenContent)
  // During exit animation, content is still rendered but animating out
  // After animation completes, contentData becomes empty
  const isVisible =
    !presentationState?.isHidden && !isExitAnimating && hasContent

  // Handle context menu (right-click) on preview
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      // Check if clicked on an existing styled element (mark, strong, u with data-highlight-id)
      const target = e.target as HTMLElement
      const styledElement = target.closest(
        '[data-highlight-id]',
      ) as HTMLElement | null
      const highlightId = styledElement?.dataset?.highlightId

      // Show context menu if text is selected OR clicking on existing styled text
      // hasSelection() reads from ref - doesn't trigger re-renders
      if (hasSelection() || highlightId) {
        e.preventDefault()
        setContextMenu({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          clickedHighlightId: highlightId,
        })
      }
    },
    [hasSelection],
  )

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0 })
  }, [])

  const handleHighlight = useCallback(() => {
    const selectedRange = getSelectedRange()
    if (!selectedRange) return
    addHighlight.mutate({
      start: selectedRange.start,
      end: selectedRange.end,
      highlight: DEFAULT_HIGHLIGHT_COLOR,
    })
    clearSelection()
  }, [getSelectedRange, addHighlight, clearSelection])

  const handleBold = useCallback(() => {
    const selectedRange = getSelectedRange()
    if (!selectedRange) return
    addHighlight.mutate({
      start: selectedRange.start,
      end: selectedRange.end,
      bold: true,
    })
    clearSelection()
  }, [getSelectedRange, addHighlight, clearSelection])

  const handleUnderline = useCallback(() => {
    const selectedRange = getSelectedRange()
    if (!selectedRange) return
    addHighlight.mutate({
      start: selectedRange.start,
      end: selectedRange.end,
      underline: true,
    })
    clearSelection()
  }, [getSelectedRange, addHighlight, clearSelection])

  const handleRemoveStyle = useCallback(() => {
    if (contextMenu.clickedHighlightId) {
      removeHighlight.mutate(contextMenu.clickedHighlightId)
    }
  }, [contextMenu.clickedHighlightId, removeHighlight])

  // Get highlights from either query or presentation state
  // Memoized to prevent unnecessary reference changes that cause re-renders
  // which could clear text selections during DOM reconciliation
  const styleRanges = useMemo((): TextStyleRange[] => {
    return (
      slideHighlights ??
      presentationState?.slideHighlights ??
      EMPTY_STYLE_RANGES
    )
  }, [slideHighlights, presentationState?.slideHighlights])

  // Loading state
  if (!screen) {
    return (
      <div className="relative h-full max-w-full aspect-video rounded-lg overflow-hidden shadow-lg bg-gray-800 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div
      ref={previewContainerRef}
      className="relative h-full max-w-full aspect-video rounded-lg overflow-hidden shadow-lg"
      onContextMenu={handleContextMenu}
    >
      <ScreenPreview
        screen={screen}
        contentType={contentType}
        contentData={contentData}
        isVisible={isVisible}
        styleRanges={styleRanges}
      />
      {contextMenu.visible && (
        <TextStyleContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={handleCloseContextMenu}
          onHighlight={handleHighlight}
          onBold={handleBold}
          onUnderline={handleUnderline}
          onRemoveStyle={handleRemoveStyle}
          showRemove={!!contextMenu.clickedHighlightId}
          highlightColor={DEFAULT_HIGHLIGHT_COLOR}
        />
      )}
    </div>
  )
}
