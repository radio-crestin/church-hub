import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { useEffect, useMemo, useState } from 'react'

import { getApiUrl, isMobile } from '~/config'
import { getStoredUserToken } from '~/service/api-url'
import { ScreenPreview } from './ScreenPreview'
import { usePresentationState, useWebSocket } from '../hooks'
import { useScreen } from '../hooks/useScreen'
import { useScreens } from '../hooks/useScreens'
import type { ContentType } from '../types'

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

  // Fetch content based on presentation state
  useEffect(() => {
    const fetchContent = async () => {
      if (!presentationState) {
        setContentData({})
        setContentType('empty')
        return
      }

      // Check if hidden
      if (presentationState.isHidden) {
        setContentData({})
        setContentType('empty')
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
            setContentType('song')
            setContentData({ mainText: currentSlide.content })
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
            const slide = item.slides?.find(
              (s: SongSlideData) =>
                s.id === presentationState.currentSongSlideId,
            )
            if (slide) {
              setContentType('song')
              setContentData({
                mainText: slide.content,
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
  ])

  const hasContent = Object.keys(contentData).length > 0
  const showClock = !hasContent || presentationState?.isHidden

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
        showClock={showClock}
      />
    </div>
  )
}
