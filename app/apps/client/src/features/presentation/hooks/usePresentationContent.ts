import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { useEffect, useRef, useState } from 'react'

import { getApiUrl, isMobile } from '~/config'
import { getStoredUserToken } from '~/service/api-url'
import { createLogger } from '~/utils/logger'
import { usePresentationState } from './usePresentationState'
import { calculateMaxExitAnimationDuration } from '../components/rendering/utils/styleUtils'
import { useSongUpdateTimestamp } from '../context/WebSocketContext'
import type {
  ContentType,
  ScreenConfig,
  SongContentConfig,
  SongLastSlideContentConfig,
  TemporaryContent,
  TemporarySongContent,
} from '../types'
import { resolveSlideChords } from '../utils/resolveSlideChords'
import {
  resolveSongKey,
  resolveSongSlideBody,
  resolveSongSlideContentType,
} from '../utils/songElements'

const logger = createLogger('app:presentation:content')

// Extra buffer time after animation completes before transitioning to empty state (ms)
const EXIT_ANIMATION_BUFFER = 200

// Check if we're running in Tauri context
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// Use Tauri fetch on mobile (iOS WKWebView blocks HTTP fetch)
const fetchFn = isTauri && isMobile() ? tauriFetch : window.fetch.bind(window)

// Queue cache to avoid redundant fetches during slide navigation
let queueCache: {
  data: QueueItem[]
  updatedAt: number
  songUpdatedAt: number
  fetchedAt: number
} | null = null
const QUEUE_CACHE_MAX_AGE = 5000 // 5 seconds

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

interface ChordMapping {
  wordIndex: number
  chord: string
}

interface SongSlide {
  id: number
  content: string
  chords?: ChordMapping[] | null
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
  chords?: ChordMapping[] | null
  songKey?: string // Song key ("gama"), populated only on the first slide
  amen?: string // "Amin", populated only on the last slide
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
  /**
   * Local "preview" override. When provided, the hook renders this content
   * instead of the server presentation state, bypassing projection entirely.
   * Used by the song-detail stage (LivePreview) for Preview mode: an operator
   * stages a slide locally before projecting it. ScreenRenderer never passes
   * this, so external screens are unaffected.
   */
  previewContent?: TemporaryContent | null
}

interface UsePresentationContentResult {
  contentType: ContentType
  contentData: ContentData
  /** Identity-based key that only changes on slide navigation, not content edits */
  contentKey: string
  isVisible: boolean
  isExitAnimating: boolean
  nextSlideData: NextSlideData | undefined
  presentationState: ReturnType<typeof usePresentationState>['data']
}

/**
 * Builds the renderable content for a single song slide from temporary song
 * content. Pure: returns the content pieces (or null if the slide is missing)
 * without touching React state. Shared by the live temporary-song path and the
 * local Preview-mode override so both render identically.
 */
function buildSongSlideContent(
  data: TemporarySongContent,
  screen: ScreenConfig | null | undefined,
  includeNextSlide: boolean,
): {
  contentType: ContentType
  contentData: ContentData
  contentKey: string
  nextSlide: NextSlideData | undefined
} | null {
  const currentSlide = data.slides[data.currentSlideIndex]
  if (!currentSlide) return null

  const isFirstSlide = data.currentSlideIndex === 0
  const isLastSlide = data.currentSlideIndex === data.slides.length - 1
  const slideContent = currentSlide.content
  const songConfig = screen?.contentConfigs?.song as
    | SongContentConfig
    | undefined
  // Key ("gama") and "Amin" are separate positionable/styleable elements, so
  // they are emitted as their own fields instead of injected into the lyrics.
  const songKeyValue = resolveSongKey(isFirstSlide, data.keyLine, songConfig)
  // Operator's custom "Amin" label (from the "Strofă - Amin" tab).
  const customAmin =
    (
      screen?.contentConfigs?.song_last_slide as
        | SongLastSlideContentConfig
        | undefined
    )?.amen?.text ?? songConfig?.amen?.text
  const { mainText: songMainText, amen: amenValue } = resolveSongSlideBody(
    isLastSlide,
    slideContent,
    customAmin,
  )
  const resolvedChords = resolveSlideChords(data.currentSlideIndex, data.slides)

  let nextSlide: NextSlideData | undefined
  if (includeNextSlide) {
    const next = data.slides[data.currentSlideIndex + 1]
    if (next) {
      nextSlide = { contentType: 'song', preview: next.content }
    } else if (data.nextItemPreview) {
      nextSlide = {
        contentType: data.nextItemPreview.contentType,
        preview: data.nextItemPreview.preview,
      }
    }
  }

  return {
    // First slide WITH a gama → song_first_slide, last slide WITH an amin →
    // song_last_slide; otherwise the plain `song` layout.
    contentType: resolveSongSlideContentType(
      isFirstSlide,
      isLastSlide,
      !!songKeyValue,
      !!amenValue,
    ),
    contentData: {
      mainText: songMainText,
      chords: resolvedChords,
      songKey: songKeyValue,
      amen: amenValue,
    },
    contentKey: `song|${data.songId}|${data.currentSlideIndex}`,
    nextSlide,
  }
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
  previewContent = null,
}: UsePresentationContentOptions): UsePresentationContentResult {
  const { data: presentationState } = usePresentationState()
  const songUpdateTimestamp = useSongUpdateTimestamp()

  const [contentType, setContentType] = useState<ContentType>('empty')
  const [contentData, setContentData] = useState<ContentData>({})
  const [contentKey, setContentKey] = useState('empty')
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
  // Synchronous flag to prevent visibility flicker during the render cycle
  // where isHidden becomes true but isExitAnimating hasn't been set yet
  const exitAnimatingSyncRef = useRef(false)
  // Tracks whether the previous render was showing a local preview override, so
  // we can clear the stage when preview is dismissed while the real projection
  // is hidden (no visible -> hidden transition to drive the exit animation).
  const prevPreviewRef = useRef<TemporaryContent | null>(previewContent)

  // Keep track of current content type for exit animation calculation
  if (contentType !== 'empty') {
    currentContentTypeRef.current = contentType
  }

  // Detect transition synchronously during render to prevent visibility flicker.
  // useEffect runs after render, so without this, there's one frame where
  // isHidden=true and isExitAnimating=false, causing content to disappear then reappear.
  const wasHiddenSync = prevHiddenRef.current
  const isHiddenSync = presentationState?.isHidden
  if (
    wasHiddenSync === false &&
    isHiddenSync &&
    !exitAnimatingSyncRef.current
  ) {
    exitAnimatingSyncRef.current = true
  }
  if (wasHiddenSync && !isHiddenSync && exitAnimatingSyncRef.current) {
    exitAnimatingSyncRef.current = false
  }

  // Handle exit animation timing - delay empty state transition
  useEffect(() => {
    const wasHidden = prevHiddenRef.current
    const isHidden = presentationState?.isHidden

    // While a local preview override drives the stage, the real isHidden state
    // is irrelevant — skip the exit-animation machinery so toggling the real
    // projection (or it being hidden) never clears the staged content. Keep the
    // ref in sync so resuming normal mode doesn't see a phantom transition.
    if (previewContent) {
      prevHiddenRef.current = isHidden
      return
    }

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
        exitAnimatingSyncRef.current = false
        setContentData({})
        setContentKey('')
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
      exitAnimatingSyncRef.current = false

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
  }, [presentationState?.isHidden, screen, previewContent])

  // Fetch content based on presentation state
  useEffect(() => {
    // Track if this effect has been superseded by a newer one
    // This prevents stale async operations from setting state
    let isCancelled = false

    const fetchContent = async () => {
      logger.debug(
        `fetchContent called: isHidden=${presentationState?.isHidden}, isExitAnimating=${isExitAnimating}, updatedAt=${presentationState?.updatedAt}`,
      )

      // Preview-mode override: render the locally staged content and skip ALL
      // server-state logic, so the slide shows only in the operator's stage and
      // is never projected. ScreenRenderer never passes previewContent.
      const wasPreview = prevPreviewRef.current
      prevPreviewRef.current = previewContent
      if (previewContent) {
        if (isCancelled) return
        const built =
          previewContent.type === 'song'
            ? buildSongSlideContent(
                previewContent.data,
                screen,
                includeNextSlide,
              )
            : null
        if (built) {
          setContentType(built.contentType)
          setContentData(built.contentData)
          // Distinct key prefix so promoting the staged slide to live (same
          // song/index) still reads as a content change for transitions.
          setContentKey(`preview|${built.contentKey}`)
          setNextSlideData(includeNextSlide ? built.nextSlide : undefined)
        } else {
          setContentData({})
          setContentKey('')
          setContentType('empty')
          setNextSlideData(undefined)
        }
        return
      }

      // Preview was just dismissed while the real projection is hidden — there's
      // no visible→hidden transition to drive the exit animation, so clear the
      // stale staged content now. (When the real state is visible, the normal
      // path below repaints it.)
      if (wasPreview && presentationState?.isHidden) {
        if (isCancelled) return
        setContentData({})
        setContentKey('')
        setContentType('empty')
        setNextSlideData(undefined)
        return
      }

      if (!presentationState) {
        logger.debug('No presentation state, setting empty content')
        if (isCancelled) return
        setContentData({})
        setContentKey('')
        setContentType('empty')
        setNextSlideData(undefined)
        return
      }

      // When hidden, don't fetch new content - check isHidden directly here because
      // isExitAnimating may still be false in the same render cycle that triggered
      // the exit animation (stale closure). isHidden is always current.
      // The exit animation effect will handle transitioning to empty state.
      if (presentationState.isHidden) {
        logger.debug(
          `Skipping fetch: isHidden=${presentationState.isHidden}, isExitAnimating=${isExitAnimating}`,
        )
        return
      }

      // Check for temporary content first (bypasses queue)
      if (presentationState.temporaryContent) {
        const temp = presentationState.temporaryContent
        logger.debug(`Temporary content detected: type=${temp.type}`)

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
          const built = buildSongSlideContent(
            temp.data,
            screen,
            includeNextSlide,
          )
          if (built) {
            if (isCancelled) return
            setContentType(built.contentType)
            setContentData(built.contentData)
            setContentKey(built.contentKey)
            if (includeNextSlide) setNextSlideData(built.nextSlide)
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

      // Fetch from queue if no temporary content (with caching)
      try {
        const stateUpdatedAt = presentationState.updatedAt || 0
        const now = Date.now()
        const cacheValid =
          queueCache &&
          queueCache.updatedAt === stateUpdatedAt &&
          queueCache.songUpdatedAt === songUpdateTimestamp &&
          now - queueCache.fetchedAt < QUEUE_CACHE_MAX_AGE

        let queueItems: QueueItem[]

        if (cacheValid) {
          logger.debug('Using cached queue data')
          queueItems = queueCache.data
        } else {
          logger.debug('Fetching fresh queue data')
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
          queueItems = queueResult.data || []
          queueCache = {
            data: queueItems,
            updatedAt: stateUpdatedAt,
            songUpdatedAt: songUpdateTimestamp,
            fetchedAt: now,
          }
        }

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
              const slideContent = slide.content
              const songCfg = screen?.contentConfigs?.song as
                | SongContentConfig
                | undefined
              // Key + Amin are emitted as separate elements (see above). A
              // standalone trailing "amin" line is pulled out of the lyrics.
              const songKeyValue = resolveSongKey(
                isFirstSlide,
                item.keyLine,
                songCfg,
              )
              // Operator's custom "Amin" label (from the "Strofă - Amin" tab).
              const customAmin =
                (
                  screen?.contentConfigs?.song_last_slide as
                    | SongLastSlideContentConfig
                    | undefined
                )?.amen?.text ?? songCfg?.amen?.text
              const { mainText: songMainText, amen: amenValue } =
                resolveSongSlideBody(isLastSlide, slideContent, customAmin)
              // Resolve chords for this slide
              const queueChords = resolveSlideChords(slideIndex, item.slides)

              if (isCancelled) return
              // First slide WITH a gama → "Cântec - Primul Slide" (song_first_slide),
              // last slide WITH an amin → "Cântec - Ultimul Slide" (song_last_slide);
              // otherwise the plain `song` layout.
              setContentType(
                resolveSongSlideContentType(
                  isFirstSlide,
                  isLastSlide,
                  !!songKeyValue,
                  !!amenValue,
                ),
              )
              setContentData({
                mainText: songMainText,
                chords: queueChords,
                songKey: songKeyValue,
                amen: amenValue,
              })
              setContentKey(`song|${item.songId}|${slideIndex}`)

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
        setContentKey('')
        setContentType('empty')
        setNextSlideData(undefined)
      } catch (error) {
        logger.debug(`Error fetching content: ${error}`)
        if (isCancelled) return
        setContentData({})
        setContentKey('')
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
    previewContent,
  ])

  // Calculate visibility
  // isVisible stays true during exit animation so CSS transitions can complete smoothly.
  // Content becomes invisible only after the exit animation finishes and state is cleared.
  const hasContent = Object.keys(contentData).length > 0
  const isVisible = previewContent
    ? // Staged preview is always shown locally regardless of the real
      // projection's hidden state.
      hasContent
    : (!presentationState?.isHidden ||
        isExitAnimating ||
        exitAnimatingSyncRef.current) &&
      hasContent

  logger.debug(
    `Render state: isVisible=${isVisible}, hasContent=${hasContent}, isHidden=${presentationState?.isHidden}, isExitAnimating=${isExitAnimating}, contentType=${contentType}, updatedAt=${presentationState?.updatedAt}`,
  )

  return {
    contentType,
    contentData,
    contentKey,
    isVisible,
    isExitAnimating,
    nextSlideData,
    presentationState,
  }
}
