import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { useEffect, useRef, useState } from 'react'

import { getApiUrl, isMobile } from '~/config'
import { getStoredUserToken } from '~/service/api-url'
import { createLogger } from '~/utils/logger'
import { usePresentationState } from './usePresentationState'
import { calculateMaxExitAnimationDuration } from '../components/rendering/utils/styleUtils'
import { useSongUpdateTimestamp } from '../context/WebSocketContext'
import type { ContentType, ScreenConfig } from '../types'
import { addAminToLastSlide } from '../utils/addAminToLastSlide'
import { addKeyLineToFirstSlide } from '../utils/addKeyLineToFirstSlide'

const logger = createLogger('usePresentationContent')

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

interface SongSlide {
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
  bibleVerseId?: number
  biblePassageVerses?: Array<{ id: number; reference: string; text: string }>
  biblePassageTranslation?: string
  verseteTineriEntries?: Array<{
    id: number
    reference: string
    text: string
    person?: string
  }>
  slides?: SongSlide[]
  keyLine?: string | null
}

export interface ContentData {
  mainText?: string
  referenceText?: string
  contentText?: string
  personLabel?: string
  secondaryContentText?: string
}

export interface NextSlideData {
  contentType: string
  preview: string
}

interface UsePresentationContentOptions {
  /** Screen config for animation duration calculation */
  screen: ScreenConfig | null | undefined
  /** Whether to calculate next slide data (for preview) */
  includeNextSlide?: boolean
  /** Function to get next verse for bible passages */
  getNextVerse?: (verseId: number) => Promise<{
    bookName: string
    chapter: number
    verse: number
    text: string
  } | null>
  /** Function to get localized book name */
  getBookName?: (bookCode: string) => string | undefined
}

interface UsePresentationContentResult {
  contentType: ContentType
  contentData: ContentData
  isVisible: boolean
  isExitAnimating: boolean
  nextSlideData: NextSlideData | undefined
  presentationState: ReturnType<typeof usePresentationState>['data']
}

/**
 * Shared hook for managing presentation content display.
 * Used by both LivePreview and ScreenRenderer to ensure consistent behavior.
 *
 * This hook handles:
 * 1. Exit animation timing - delays empty state transition for smooth animations
 * 2. Content fetching - determines what to display based on presentation state
 * 3. Visibility calculation - determines if content should be visible
 */
export function usePresentationContent({
  screen,
  includeNextSlide = false,
  getNextVerse,
  getBookName,
}: UsePresentationContentOptions): UsePresentationContentResult {
  const { data: presentationState } = usePresentationState()
  const songUpdateTimestamp = useSongUpdateTimestamp()

  const [contentType, setContentType] = useState<ContentType>('empty')
  const [contentData, setContentData] = useState<ContentData>({})
  const [nextSlideData, setNextSlideData] = useState<
    NextSlideData | undefined
  >()
  const [isExitAnimating, setIsExitAnimating] = useState(false)

  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevHiddenRef = useRef(presentationState?.isHidden)
  const currentContentTypeRef = useRef<ContentType>(contentType)
  // Track if exit animation should complete - prevents race condition where
  // timeout fires after user has started a new presentation
  const shouldCompleteExitRef = useRef(false)

  // Keep track of current content type for exit animation calculation
  if (contentType !== 'empty') {
    currentContentTypeRef.current = contentType
  }

  // Handle exit animation timing - delay empty state transition
  useEffect(() => {
    const wasHidden = prevHiddenRef.current
    const isHidden = presentationState?.isHidden

    logger.debug(
      `Exit animation effect: wasHidden=${wasHidden}, isHidden=${isHidden}, isExitAnimating=${isExitAnimating}, updatedAt=${presentationState?.updatedAt}`,
    )

    // Detect transition from visible to hidden
    // wasHidden must be explicitly false (not undefined) to count as "was visible"
    // This prevents false triggering on initial load when prevHiddenRef is undefined
    if (wasHidden === false && isHidden) {
      logger.debug('Transition: visible -> hidden, starting exit animation')
      // Clear any existing timeout
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current)
      }

      // Mark that exit animation should complete
      shouldCompleteExitRef.current = true

      // Start exit animation
      setIsExitAnimating(true)

      // Calculate the max exit animation duration from the current content type's config
      const currentConfig =
        screen?.contentConfigs[currentContentTypeRef.current]
      const animationDuration = calculateMaxExitAnimationDuration(currentConfig)
      const totalDelay = animationDuration + EXIT_ANIMATION_BUFFER

      logger.debug(
        `Exit animation scheduled for ${totalDelay}ms (animation: ${animationDuration}ms)`,
      )

      // After animation duration + buffer, transition to empty state
      exitTimeoutRef.current = setTimeout(() => {
        // Only execute if exit wasn't cancelled (e.g., by starting new presentation)
        if (!shouldCompleteExitRef.current) {
          logger.debug('Exit animation cancelled, skipping content clear')
          return
        }
        logger.debug('Exit animation complete, clearing content')
        setContentData({})
        setContentType('empty')
        setNextSlideData(undefined)
        setIsExitAnimating(false)
      }, totalDelay)
    }

    // If becoming visible, cancel any pending exit transition
    if (wasHidden && !isHidden) {
      logger.debug('Transition: hidden -> visible, cancelling exit animation')
      // Cancel exit animation - this prevents the timeout from clearing content
      shouldCompleteExitRef.current = false

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
    // Track if this effect has been superseded by a newer one
    // This prevents stale async operations from setting state
    let isCancelled = false

    const fetchContent = async () => {
      logger.debug(
        `fetchContent called: isHidden=${presentationState?.isHidden}, isExitAnimating=${isExitAnimating}, updatedAt=${presentationState?.updatedAt}`,
      )

      if (!presentationState) {
        logger.debug('No presentation state, setting empty content')
        if (isCancelled) return
        setContentData({})
        setContentType('empty')
        setNextSlideData(undefined)
        return
      }

      // When hidden or exit animating, don't fetch new content
      // The exit animation effect will handle transitioning to empty state
      if (presentationState.isHidden || isExitAnimating) {
        logger.debug(
          `Skipping fetch: isHidden=${presentationState.isHidden}, isExitAnimating=${isExitAnimating}`,
        )
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
          const chapterVerseMatch = data.reference.match(/(\d+:\d+)/)
          const chapterVerse = chapterVerseMatch?.[1] || ''

          // Use localized book name if available
          const localizedBookName =
            getBookName?.(data.bookCode) || data.bookName

          const referenceText = `${localizedBookName} ${chapterVerse}`

          // Combine primary + secondary text with empty line
          let contentText = data.text
          if (hasSecondary && data.secondaryText) {
            contentText = `${data.text}\n\n${data.secondaryText}`
          }

          if (isCancelled) return
          setContentType('bible')
          setContentData({
            referenceText,
            contentText,
            secondaryContentText: data.secondaryText,
          })

          // Show next verse preview if enabled
          if (includeNextSlide && getNextVerse && data.verseId) {
            try {
              const nextVerse = await getNextVerse(data.verseId)
              if (nextVerse && !isCancelled) {
                const nextReference = `${nextVerse.bookName} ${nextVerse.chapter}:${nextVerse.verse}`
                setNextSlideData({
                  contentType: 'bible',
                  preview: `${nextReference}: ${nextVerse.text}`,
                })
              } else if (!isCancelled) {
                setNextSlideData(undefined)
              }
            } catch {
              if (!isCancelled) setNextSlideData(undefined)
            }
          } else {
            setNextSlideData(undefined)
          }
          return
        }

        if (temp.type === 'song') {
          const currentSlide = temp.data.slides[temp.data.currentSlideIndex]
          if (currentSlide && !isCancelled) {
            const isFirstSlide = temp.data.currentSlideIndex === 0
            const isLastSlide =
              temp.data.currentSlideIndex === temp.data.slides.length - 1
            let slideContent = currentSlide.content
            slideContent = addKeyLineToFirstSlide(
              slideContent,
              isFirstSlide,
              temp.data.keyLine,
            )
            slideContent = addAminToLastSlide(slideContent, isLastSlide)
            setContentType('song')
            setContentData({ mainText: slideContent })

            // Show next slide preview if enabled
            if (includeNextSlide) {
              const nextSlide =
                temp.data.slides[temp.data.currentSlideIndex + 1]
              if (nextSlide) {
                setNextSlideData({
                  contentType: 'song',
                  preview: nextSlide.content,
                })
              } else if (temp.data.nextItemPreview) {
                setNextSlideData({
                  contentType: temp.data.nextItemPreview.contentType,
                  preview: temp.data.nextItemPreview.preview,
                })
              } else {
                setNextSlideData(undefined)
              }
            }
            return
          }
        }

        if (temp.type === 'announcement') {
          if (isCancelled) return
          setContentType('announcement')
          setContentData({ mainText: temp.data.content })
          setNextSlideData(undefined)
          return
        }

        if (temp.type === 'bible_passage') {
          const currentVerse = temp.data.verses[temp.data.currentVerseIndex]
          if (currentVerse && !isCancelled) {
            const reference = `${temp.data.bookName} ${temp.data.startChapter}:${currentVerse.verse}`
            setContentType('bible_passage')
            setContentData({
              referenceText: reference,
              contentText: currentVerse.text,
            })

            // Show next verse preview if enabled
            if (includeNextSlide) {
              const nextVerse =
                temp.data.verses[temp.data.currentVerseIndex + 1]
              if (nextVerse) {
                setNextSlideData({
                  contentType: 'bible_passage',
                  preview: `${temp.data.bookName} ${temp.data.startChapter}:${nextVerse.verse}: ${nextVerse.text}`,
                })
              } else {
                setNextSlideData(undefined)
              }
            }
            return
          }
        }

        if (temp.type === 'versete_tineri') {
          const currentEntry = temp.data.entries[temp.data.currentEntryIndex]
          if (currentEntry && !isCancelled) {
            setContentType('versete_tineri')
            setContentData({
              personLabel: currentEntry.personName,
              referenceText: currentEntry.reference,
              contentText: currentEntry.text,
            })

            // Show next entry preview if enabled
            if (includeNextSlide) {
              const nextEntry =
                temp.data.entries[temp.data.currentEntryIndex + 1]
              if (nextEntry) {
                setNextSlideData({
                  contentType: 'versete_tineri',
                  preview: `${nextEntry.personName}: ${nextEntry.reference}`,
                })
              } else {
                setNextSlideData(undefined)
              }
            }
            return
          }
        }

        if (temp.type === 'screen_share') {
          if (isCancelled) return
          setContentType('screen_share')
          setContentData({})
          setNextSlideData(undefined)
          return
        }

        if (temp.type === 'scene') {
          if (isCancelled) return
          setContentType('scene')
          setContentData({ mainText: temp.data.sceneId.toString() })
          setNextSlideData(undefined)
          return
        }
      }

      // Fetch from queue if no temporary content
      try {
        const queueResponse = await fetchFn(`${getApiUrl()}/api/queue`, {
          cache: 'no-store',
          headers: getHeaders(),
          credentials: 'include',
        })

        if (!queueResponse.ok) {
          if (isCancelled) return
          setContentData({})
          setContentType('empty')
          setNextSlideData(undefined)
          return
        }

        const queueResult = await queueResponse.json()
        const queueItems: QueueItem[] = queueResult.data || []

        // Find current content - song slide
        if (presentationState.currentSongSlideId) {
          for (const item of queueItems) {
            const slideIndex = item.slides?.findIndex(
              (s) => s.id === presentationState.currentSongSlideId,
            )
            if (slideIndex !== undefined && slideIndex !== -1 && item.slides) {
              const slide = item.slides[slideIndex]
              const isFirstSlide = slideIndex === 0
              const isLastSlide = slideIndex === item.slides.length - 1
              let slideContent = slide.content
              slideContent = addKeyLineToFirstSlide(
                slideContent,
                isFirstSlide,
                item.keyLine,
              )
              slideContent = addAminToLastSlide(slideContent, isLastSlide)

              if (isCancelled) return
              setContentType('song')
              setContentData({ mainText: slideContent })

              // Show next slide preview if enabled
              if (includeNextSlide) {
                const nextSlide = item.slides[slideIndex + 1]
                if (nextSlide) {
                  setNextSlideData({
                    contentType: 'song',
                    preview: nextSlide.content,
                  })
                } else {
                  setNextSlideData(undefined)
                }
              }
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

                if (entry && !isCancelled) {
                  setContentType('versete_tineri')
                  setContentData({
                    personLabel: entry.person || '',
                    referenceText: entry.reference,
                    contentText: entry.text,
                  })
                  setNextSlideData(undefined)
                  return
                }
              }

              // Regular announcement slide
              if (isCancelled) return
              setContentType('announcement')
              setContentData({ mainText: queueItem.slideContent || '' })
              setNextSlideData(undefined)
              return
            }

            if (queueItem.itemType === 'bible') {
              const reference = (queueItem.bibleReference || '').replace(
                /\s*-\s*[A-Z]+\s*$/,
                '',
              )
              if (isCancelled) return
              setContentType('bible')
              setContentData({
                referenceText: reference,
                contentText: queueItem.bibleText || '',
              })
              setNextSlideData(undefined)
              return
            }

            if (queueItem.itemType === 'bible_passage') {
              const verseId = presentationState.currentBiblePassageVerseId
              const verse = verseId
                ? queueItem.biblePassageVerses?.find((v) => v.id === verseId)
                : queueItem.biblePassageVerses?.[0]

              if (verse && !isCancelled) {
                setContentType('bible_passage')
                setContentData({
                  referenceText: verse.reference,
                  contentText: verse.text,
                })
                setNextSlideData(undefined)
                return
              }
            }
          }
        }

        // No content, show empty
        if (isCancelled) return
        setContentData({})
        setContentType('empty')
        setNextSlideData(undefined)
      } catch (error) {
        logger.debug(`Error fetching content: ${error}`)
        if (isCancelled) return
        setContentData({})
        setContentType('empty')
        setNextSlideData(undefined)
      }
    }

    fetchContent()

    // Cleanup: mark this effect as cancelled so stale async ops don't set state
    return () => {
      isCancelled = true
    }
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
    // Refetch when a song is updated via WebSocket
    songUpdateTimestamp,
    includeNextSlide,
    getNextVerse,
    getBookName,
  ])

  // Calculate visibility
  const hasContent = Object.keys(contentData).length > 0
  const isVisible =
    !presentationState?.isHidden && !isExitAnimating && hasContent

  logger.debug(
    `Render state: isVisible=${isVisible}, hasContent=${hasContent}, isHidden=${presentationState?.isHidden}, isExitAnimating=${isExitAnimating}, contentType=${contentType}, updatedAt=${presentationState?.updatedAt}`,
  )

  return {
    contentType,
    contentData,
    isVisible,
    isExitAnimating,
    nextSlideData,
    presentationState,
  }
}
