import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useNavigateTemporary } from '~/features/presentation'
import { BibleTopicSlideshowBar } from './BibleTopicSlideshowBar'
import { useVerseSlideshow } from '../../hooks/useVerseSlideshow'
import type { BibleVerse } from '../../types'
import type { BibleTopicPassage } from '../types'
import { toSlideshowEntries } from '../utils/toSlideshowEntries'

interface BibleTopicPassagesProps {
  topicId: number
  title: string
  passages: BibleTopicPassage[]
  isLoading: boolean
  /** The verse on screen, to mark its passage */
  activeVerseId?: number
  onBack: () => void
  onPresentVerse: (verse: BibleVerse) => void
  onOpenVerse: (verse: BibleVerse) => void
}

/**
 * A topic's passages in the current translation, best first. A passage
 * presents its first verse (the Bible's next verse continues it);
 * Previous / Next present the topic's passages one by one, and the bar above
 * plays them all as a slideshow timed to each passage's length.
 */
export function BibleTopicPassages({
  topicId,
  title,
  passages,
  isLoading,
  activeVerseId,
  onBack,
  onPresentVerse,
  onOpenVerse,
}: BibleTopicPassagesProps) {
  const { t } = useTranslation('bible')
  const entries = useMemo(() => toSlideshowEntries(passages), [passages])
  const slideshow = useVerseSlideshow(`topic:${topicId}`, entries)
  const navigateSlideshow = useNavigateTemporary()
  const activeIndex =
    slideshow.position?.index ??
    passages.findIndex((passage) =>
      passage.verses.some((verse) => verse.id === activeVerseId),
    )

  // While the slideshow plays, the arrows step it (its timer starts over).
  const present = (index: number) => {
    if (slideshow.isPlaying) {
      navigateSlideshow.mutate({
        direction: index > activeIndex ? 'next' : 'prev',
      })
      return
    }
    const verse = passages[index]?.verses[0]
    if (verse) onPresentVerse(verse)
  }

  return (
    <>
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-line flex-shrink-0">
        <button
          type="button"
          onClick={onBack}
          data-testid="bible-topic-back"
          aria-label={t('topics.back')}
          title={t('topics.back')}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <span
          data-testid="bible-topic-title"
          className="min-w-0 flex-1 truncate text-[13px] font-semibold text-fg"
        >
          {title}
        </span>
        <button
          type="button"
          onClick={() => present(activeIndex - 1)}
          disabled={activeIndex <= 0}
          data-testid="bible-topic-previous"
          aria-label={t('topics.previous')}
          title={t('topics.previous')}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <span className="text-xs tabular-nums text-fg-hint">
          {activeIndex >= 0 ? activeIndex + 1 : '–'}/{passages.length}
        </span>
        <button
          type="button"
          onClick={() => present(activeIndex + 1)}
          disabled={activeIndex >= passages.length - 1}
          data-testid="bible-topic-next"
          aria-label={t('topics.next')}
          title={t('topics.next')}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg disabled:opacity-40"
        >
          <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      {passages.length > 0 && <BibleTopicSlideshowBar slideshow={slideshow} />}

      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
        {isLoading ? (
          <div className="px-4 py-6 text-center text-[13px] text-fg-hint">
            ...
          </div>
        ) : (
          <ul className="p-1.5 flex flex-col gap-0.5">
            {passages.map((passage, index) => {
              const first = passage.verses[0]
              if (!first) return null
              const isActive = index === activeIndex
              return (
                <li
                  key={`${passage.book}-${passage.chapter}-${passage.startVerse}`}
                  data-testid="bible-topic-passage"
                  data-active={isActive || undefined}
                  className={`flex items-start gap-1 rounded-lg ${
                    isActive ? 'bg-live-tint ring-1 ring-inset ring-live' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onPresentVerse(first)}
                    title={t('topics.present')}
                    className="min-w-0 flex-1 px-2.5 py-2 text-left hover:bg-hover rounded-l-lg"
                  >
                    <span className="block text-xs font-semibold text-fg-label">
                      {passage.reference}
                    </span>
                    <span className="block text-[13px] text-fg-body">
                      {passage.verses.map((verse) => (
                        <span key={verse.id}>
                          {passage.verses.length > 1 && (
                            <sup className="mr-0.5 text-fg-hint">
                              {verse.verse}
                            </sup>
                          )}
                          {verse.text}{' '}
                        </span>
                      ))}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenVerse(first)}
                    data-testid="bible-topic-open"
                    aria-label={t('topics.openInBible')}
                    title={t('topics.openInBible')}
                    className="m-1 p-1.5 rounded-md text-fg-hint hover:bg-hover hover:text-fg"
                  >
                    <BookOpen className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
