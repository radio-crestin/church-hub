import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { useEffect, useMemo, useRef, useState } from 'react'

import { getApiUrl, isMobile } from '~/config'
import { getStoredUserToken } from '~/service/api-url'
import { calculateMaxExitAnimationDuration } from './rendering/utils/styleUtils'
import { ScreenPreview } from './ScreenPreview'
import { usePresentationState, useWebSocket } from '../hooks'
import { useScreen } from '../hooks/useScreen'
import { useScreens } from '../hooks/useScreens'
import type { ContentType } from '../types'
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
}

export function LivePreview() {
  // Connect to WebSocket for real-time updates
  useWebSocket()

  const { data: presentationState } = usePresentationState()
  const { data: screens } = useScreens()

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
          // Remove translation abbreviation from reference if present
          const reference = temp.data.reference.replace(/\s*-\s*[A-Z]+\s*$/, '')
          setContentType('bible')
          setContentData({
            referenceText: reference,
            contentText: temp.data.text,
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

  // Loading state
  if (!screen) {
    return (
      <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-lg bg-gray-800 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-lg">
      <ScreenPreview
        screen={screen}
        contentType={contentType}
        contentData={contentData}
        isVisible={isVisible}
      />
    </div>
  )
}
