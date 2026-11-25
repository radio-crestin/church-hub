import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useNavigateTemporary } from '~/features/presentation'
import { BibleTopicSlideshowBar } from './BibleTopicSlideshowBar'
import { useVerseSlideshow } from '../../hooks/useVerseSlideshow'
import type { BibleVerse } from '../../types'
import { useTopicLoopTemplate } from '../hooks/useTopicLoopTemplate'
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
  const [templateId, setTemplateId] = useTopicLoopTemplate()
  const slideshow = useVerseSlideshow(`topic:${topicId}`, entries, templateId)
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
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <button
          type="button"
          onClick={onBack}
          data-testid="bible-topic-back"
          aria-label={t('topics.back')}
          title={t('topics.back')}
          className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span
          data-testid="bible-topic-title"
          className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100"
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
          className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
          {activeIndex >= 0 ? activeIndex + 1 : '–'}/{passages.length}
        </span>
        <button
          type="button"
          onClick={() => present(activeIndex + 1)}
          disabled={activeIndex >= passages.length - 1}
          data-testid="bible-topic-next"
          aria-label={t('topics.next')}
          title={t('topics.next')}
          className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {passages.length > 0 && (
        <BibleTopicSlideshowBar
          slideshow={slideshow}
          templateId={templateId}
          onTemplateChange={setTemplateId}
        />
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
        {isLoading ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            ...
          </div>
        ) : (
          <ul className="p-2 flex flex-col gap-1.5">
            {passages.map((passage, index) => {
              const first = passage.verses[0]
              if (!first) return null
              const isActive = index === activeIndex
              return (
                <li
                  key={`${passage.book}-${passage.chapter}-${passage.startVerse}`}
                  data-testid="bible-topic-passage"
                  data-active={isActive || undefined}
                  className={`flex items-start gap-1 rounded-md border ${
                    isActive
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onPresentVerse(first)}
                    title={t('topics.present')}
                    className="min-w-0 flex-1 px-2.5 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-l-md"
                  >
                    <span className="block text-xs font-semibold text-teal-700 dark:text-teal-400">
                      {passage.reference}
                    </span>
                    <span className="block text-sm text-gray-800 dark:text-gray-200">
                      {passage.verses.map((verse) => (
                        <span key={verse.id}>
                          {passage.verses.length > 1 && (
                            <sup className="mr-0.5 text-gray-400">
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
                    className="m-1 p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    <BookOpen className="w-4 h-4" />
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
