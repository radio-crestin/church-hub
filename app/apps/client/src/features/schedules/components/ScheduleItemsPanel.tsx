import {
  Book,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Megaphone,
  Music,
  User,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePresentationState } from '~/features/presentation'
import { expandSongSlidesWithChoruses } from '~/features/songs/utils/expandSongSlides'
import type { ScheduleItem } from '../types'

interface ScheduleItemsPanelProps {
  items: ScheduleItem[]
  isLoading: boolean
  onSlideClick: (item: ScheduleItem, slideIndex: number) => void
  onVerseClick: (item: ScheduleItem, verseIndex: number) => void
  onEntryClick: (item: ScheduleItem, entryIndex: number) => void
  onAnnouncementClick: (item: ScheduleItem) => void
}

const SCROLL_OFFSET_TOP = 100

/**
 * Decode HTML entities to their corresponding characters
 */
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}

/**
 * Strip HTML tags and extract plain text content
 */
function stripHtmlTags(html: string): string {
  const stripped = html
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim()

  return decodeHtmlEntities(stripped)
}

interface ExpandedState {
  [key: string]: boolean
}

export function ScheduleItemsPanel({
  items,
  isLoading,
  onSlideClick,
  onVerseClick,
  onEntryClick,
  onAnnouncementClick,
}: ScheduleItemsPanelProps) {
  const { t } = useTranslation('schedules')
  const { data: presentationState } = usePresentationState()
  const highlightedRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Track which items are expanded
  const [expanded, setExpanded] = useState<ExpandedState>(() => {
    // Start with all items expanded
    const initial: ExpandedState = {}
    items.forEach((item) => {
      initial[`${item.id}`] = true
    })
    return initial
  })

  // Update expanded state when items change
  useEffect(() => {
    setExpanded((prev) => {
      const next: ExpandedState = {}
      items.forEach((item) => {
        next[`${item.id}`] = prev[`${item.id}`] ?? true
      })
      return next
    })
  }, [items])

  // Determine what's currently presented
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

    // For other types, we'll need to track via scheduleItemId
    // TODO: Add support for bible_passage, versete_tineri, announcement
    return null
  }, [presentationState?.temporaryContent])

  // Auto-scroll to the presented slide
  useEffect(() => {
    if (highlightedRef.current && containerRef.current) {
      const container = containerRef.current
      const element = highlightedRef.current
      const elementRect = element.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      const elementTop =
        elementRect.top - containerRect.top + container.scrollTop

      const targetScrollTop = Math.max(0, elementTop - SCROLL_OFFSET_TOP)

      container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
      })
    }
  }, [presentedInfo?.slideIndex, presentedInfo?.songId])

  const toggleExpanded = (itemId: number) => {
    setExpanded((prev) => ({
      ...prev,
      [`${itemId}`]: !prev[`${itemId}`],
    }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-sm">{t('editor.noItems')}</p>
        <p className="text-xs mt-1">{t('editor.addFirstItem')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div
        ref={containerRef}
        className="flex-1 min-h-0 space-y-2 overflow-hidden lg:overflow-y-auto px-0.5 py-0.5"
      >
        {items.map((item) => {
          const isExpanded = expanded[`${item.id}`] ?? true

          return (
            <div
              key={item.id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
            >
              {/* Item Header */}
              <button
                type="button"
                onClick={() => toggleExpanded(item.id)}
                className="w-full flex items-center gap-2 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                {/* Expand/Collapse Icon */}
                <div className="flex-shrink-0">
                  {isExpanded ? (
                    <ChevronDown
                      size={16}
                      className="text-gray-400 dark:text-gray-500"
                    />
                  ) : (
                    <ChevronRight
                      size={16}
                      className="text-gray-400 dark:text-gray-500"
                    />
                  )}
                </div>

                {/* Item Icon */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 flex items-center justify-center">
                  {item.itemType === 'song' && <Music size={16} />}
                  {item.itemType === 'slide' &&
                    item.slideType === 'announcement' && (
                      <Megaphone size={16} />
                    )}
                  {item.itemType === 'slide' &&
                    item.slideType === 'versete_tineri' && <User size={16} />}
                  {item.itemType === 'bible_passage' && <Book size={16} />}
                </div>

                {/* Item Title & Info */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-medium text-sm truncate text-gray-900 dark:text-white">
                    {item.itemType === 'song' && item.song?.title}
                    {item.itemType === 'slide' &&
                      item.slideType === 'announcement' &&
                      t('presenter.announcement')}
                    {item.itemType === 'slide' &&
                      item.slideType === 'versete_tineri' &&
                      t('presenter.verseteTineri')}
                    {item.itemType === 'bible_passage' &&
                      item.biblePassageReference}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {item.itemType === 'song' && (
                      <>
                        {item.slides.length} slides
                        {item.song?.categoryName &&
                          ` • ${item.song.categoryName}`}
                      </>
                    )}
                    {item.itemType === 'bible_passage' && (
                      <>
                        {item.biblePassageVerses.length} verses •{' '}
                        {item.biblePassageTranslation}
                      </>
                    )}
                    {item.itemType === 'slide' &&
                      item.slideType === 'versete_tineri' && (
                        <>{item.verseteTineriEntries.length} entries</>
                      )}
                  </div>
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-1">
                  {/* Song Slides */}
                  {item.itemType === 'song' && (
                    <SongSlides
                      item={item}
                      presentedInfo={presentedInfo}
                      highlightedRef={highlightedRef}
                      onSlideClick={onSlideClick}
                    />
                  )}

                  {/* Bible Passage Verses */}
                  {item.itemType === 'bible_passage' && (
                    <BiblePassageVerses
                      item={item}
                      onVerseClick={onVerseClick}
                    />
                  )}

                  {/* Versete Tineri Entries */}
                  {item.itemType === 'slide' &&
                    item.slideType === 'versete_tineri' && (
                      <VerseteTineriEntries
                        item={item}
                        onEntryClick={onEntryClick}
                      />
                    )}

                  {/* Announcement Slide */}
                  {item.itemType === 'slide' &&
                    item.slideType === 'announcement' && (
                      <AnnouncementSlide
                        item={item}
                        onAnnouncementClick={onAnnouncementClick}
                      />
                    )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Song Slides sub-component
interface SongSlidesProps {
  item: ScheduleItem
  presentedInfo: {
    type: 'song'
    songId: number
    slideIndex: number
  } | null
  highlightedRef: React.RefObject<HTMLButtonElement | null>
  onSlideClick: (item: ScheduleItem, slideIndex: number) => void
}

function SongSlides({
  item,
  presentedInfo,
  highlightedRef,
  onSlideClick,
}: SongSlidesProps) {
  // Expand slides with dynamic chorus insertion
  const expandedSlides = useMemo(
    () => expandSongSlidesWithChoruses(item.slides),
    [item.slides],
  )

  return (
    <>
      {expandedSlides.map((slide, index) => {
        const isPresented =
          presentedInfo?.type === 'song' &&
          presentedInfo.songId === item.songId &&
          presentedInfo.slideIndex === index

        const plainText = stripHtmlTags(slide.content)

        return (
          <button
            key={`${slide.id}-${index}`}
            ref={isPresented ? highlightedRef : null}
            type="button"
            onClick={() => onSlideClick(item, index)}
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
              isPresented
                ? 'bg-green-100 dark:bg-green-900/50 ring-2 ring-green-500'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-900/50'
            }`}
          >
            <div className="flex items-start gap-2">
              <span
                className={`font-semibold text-sm min-w-[24px] ${
                  isPresented
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {index + 1}
              </span>
              <span
                className={`text-sm whitespace-pre-line line-clamp-3 ${
                  isPresented
                    ? 'text-green-900 dark:text-green-100'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {plainText}
              </span>
            </div>
            {slide.label && (
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-8 mt-1 block">
                {slide.label}
              </span>
            )}
          </button>
        )
      })}
    </>
  )
}

// Bible Passage Verses sub-component
interface BiblePassageVersesProps {
  item: ScheduleItem
  onVerseClick: (item: ScheduleItem, verseIndex: number) => void
}

function BiblePassageVerses({ item, onVerseClick }: BiblePassageVersesProps) {
  return (
    <>
      {item.biblePassageVerses.map((verse, index) => (
        <button
          key={verse.id}
          type="button"
          onClick={() => onVerseClick(item, index)}
          className="w-full text-left px-3 py-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-900/50"
        >
          <div className="flex items-start gap-2">
            <span className="font-semibold text-sm min-w-[24px] text-gray-500 dark:text-gray-400">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                {verse.reference}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 block">
                {verse.text}
              </span>
            </div>
          </div>
        </button>
      ))}
    </>
  )
}

// Versete Tineri Entries sub-component
interface VerseteTineriEntriesProps {
  item: ScheduleItem
  onEntryClick: (item: ScheduleItem, entryIndex: number) => void
}

function VerseteTineriEntries({
  item,
  onEntryClick,
}: VerseteTineriEntriesProps) {
  return (
    <>
      {item.verseteTineriEntries.map((entry, index) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => onEntryClick(item, index)}
          className="w-full text-left px-3 py-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-900/50"
        >
          <div className="flex items-start gap-2">
            <span className="font-semibold text-sm min-w-[24px] text-gray-500 dark:text-gray-400">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <User size={12} className="text-gray-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {entry.personName}
                </span>
              </div>
              <span className="text-xs text-indigo-600 dark:text-indigo-400">
                {entry.reference}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 block">
                {entry.text}
              </span>
            </div>
          </div>
        </button>
      ))}
    </>
  )
}

// Announcement Slide sub-component
interface AnnouncementSlideProps {
  item: ScheduleItem
  onAnnouncementClick: (item: ScheduleItem) => void
}

function AnnouncementSlide({
  item,
  onAnnouncementClick,
}: AnnouncementSlideProps) {
  const plainText = stripHtmlTags(item.slideContent || '')

  return (
    <button
      type="button"
      onClick={() => onAnnouncementClick(item)}
      className="w-full text-left px-3 py-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-900/50"
    >
      <div className="flex items-start gap-2">
        <FileText size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
        <span className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
          {plainText}
        </span>
      </div>
    </button>
  )
}
