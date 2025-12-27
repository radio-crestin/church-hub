import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { useEffect, useState } from 'react'

import { getApiUrl, isMobile } from '~/config'
import { getStoredUserToken } from '~/service/api-url'
import { ClockElement } from './ClockElement'
import { ContentRenderer } from './ContentRenderer'
import { getBackgroundCSS } from './utils/styleUtils'
import { usePresentationState, useScreens, useWebSocket } from '../../hooks'
import type { ContentType, ScreenWithConfigs } from '../../types'

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
  type: ContentType
  mainText?: string
  referenceText?: string
  contentText?: string
  personLabel?: string
}

export function LivePreviewRenderer() {
  useWebSocket()

  const { data: presentationState } = usePresentationState()
  const { data: screens } = useScreens()

  const [contentData, setContentData] = useState<ContentData | null>(null)
  const [contentType, setContentType] = useState<ContentType>('empty')

  // Get the first primary screen for preview (regardless of window open state)
  const primaryScreen = screens?.find((s) => s.type === 'primary') as
    | ScreenWithConfigs
    | undefined

  // Fetch content based on presentation state
  useEffect(() => {
    const fetchContent = async () => {
      if (!presentationState) {
        setContentData(null)
        setContentType('empty')
        return
      }

      if (presentationState.isHidden) {
        setContentData(null)
        setContentType('empty')
        return
      }

      try {
        const queueResponse = await fetchFn(`${getApiUrl()}/api/queue`, {
          cache: 'no-store',
          headers: getHeaders(),
          credentials: 'include',
        })

        if (!queueResponse.ok) {
          setContentData(null)
          setContentType('empty')
          return
        }

        const queueResult = await queueResponse.json()
        const queueItems: QueueItem[] = queueResult.data || []

        // Find current content
        if (presentationState.currentSongSlideId) {
          for (const item of queueItems) {
            const slide = item.slides?.find(
              (s: SongSlideData) =>
                s.id === presentationState.currentSongSlideId,
            )
            if (slide) {
              setContentType('song')
              setContentData({
                type: 'song',
                mainText: slide.content,
              })
              return
            }
          }
        }

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
                    type: 'versete_tineri',
                    personLabel: entry.person || '',
                    referenceText: entry.reference,
                    contentText: entry.text,
                  })
                  return
                }
              }

              setContentType('announcement')
              setContentData({
                type: 'announcement',
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
                type: 'bible',
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
                  type: 'bible_passage',
                  referenceText: verse.reference,
                  contentText: verse.text,
                })
                return
              }
            }
          }
        }

        setContentData(null)
        setContentType('empty')
      } catch (_error) {
        setContentData(null)
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
  ])

  // Fallback to legacy preview if no screen configured
  if (!primaryScreen) {
    return (
      <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-lg bg-gray-800">
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          No screen configured
        </div>
      </div>
    )
  }

  const config = primaryScreen.contentConfigs[contentType]
  const backgroundConfig =
    config?.background || primaryScreen.contentConfigs.empty?.background

  const hasContent = contentData !== null
  const isVisible = hasContent && !presentationState?.isHidden

  // Calculate scale to fit aspect ratio in preview
  const aspectRatio = primaryScreen.width / primaryScreen.height

  return (
    <div className="relative w-full rounded-lg overflow-hidden shadow-lg">
      <div
        className="relative overflow-hidden"
        style={{
          paddingTop: `${(1 / aspectRatio) * 100}%`,
        }}
      >
        <div
          className="absolute inset-0"
          style={
            backgroundConfig
              ? getBackgroundCSS(backgroundConfig)
              : { backgroundColor: '#1f2937' }
          }
        >
          {isVisible && contentData && config ? (
            <div
              className="absolute inset-0"
              style={{
                transform: `scale(${1 / (primaryScreen.width / 100)})`,
                transformOrigin: 'top left',
                width: primaryScreen.width,
                height: primaryScreen.height,
              }}
            >
              <ContentRenderer
                contentType={contentType}
                contentData={contentData}
                config={config}
                globalSettings={primaryScreen.globalSettings}
                screenWidth={primaryScreen.width}
                screenHeight={primaryScreen.height}
                isVisible={isVisible}
              />
            </div>
          ) : primaryScreen.contentConfigs.empty?.clock ? (
            <div
              className="absolute inset-0"
              style={{
                transform: `scale(${1 / (primaryScreen.width / 100)})`,
                transformOrigin: 'top left',
                width: primaryScreen.width,
                height: primaryScreen.height,
              }}
            >
              <ClockElement
                config={primaryScreen.contentConfigs.empty.clock}
                screenWidth={primaryScreen.width}
                screenHeight={primaryScreen.height}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
