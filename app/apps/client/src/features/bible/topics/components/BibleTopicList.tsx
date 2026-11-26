import { ChevronRight, Search } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { ClearSearchButton } from '~/ui/search'
import type { BibleTopic } from '../types'
import { filterBibleTopics } from '../utils/filterBibleTopics'

interface BibleTopicListProps {
  topics: BibleTopic[]
  isLoading: boolean
  query: string
  onQueryChange: (query: string) => void
  titleOf: (topic: BibleTopic) => string
  /** The title in the other language, shown under the main one */
  subtitleOf: (topic: BibleTopic) => string
  onOpenTopic: (topic: BibleTopic) => void
}

/** The topics, searched by their Romanian and English titles. */
export function BibleTopicList({
  topics,
  isLoading,
  query,
  onQueryChange,
  titleOf,
  subtitleOf,
  onOpenTopic,
}: BibleTopicListProps) {
  const { t } = useTranslation('bible')
  const inputRef = useRef<HTMLInputElement>(null)
  const visible = useMemo(
    () => filterBibleTopics(topics, query, titleOf),
    [topics, query, titleOf],
  )

  return (
    <>
      <div className="px-3 py-1.5 border-b border-line flex-shrink-0">
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-hint"
            strokeWidth={1.75}
          />
          <input
            ref={inputRef}
            data-slide-navigation=""
            data-testid="bible-topics-search"
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t('topics.searchPlaceholder')}
            className="w-full h-8 pl-8 pr-7 text-sm bg-field rounded-[10px] text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
          />
          {query && (
            <ClearSearchButton
              inputRef={inputRef}
              onClear={() => onQueryChange('')}
              size={14}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-hint hover:text-fg-label"
            />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
        {isLoading ? (
          <div className="px-4 py-6 text-center text-sm text-fg-hint">...</div>
        ) : visible.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-fg-hint">
            {topics.length === 0 ? t('topics.empty') : t('topics.noResults')}
          </div>
        ) : (
          <ul className="p-1.5 flex flex-col gap-0.5">
            {visible.map((topic) => (
              <li key={topic.id}>
                <button
                  type="button"
                  data-testid={`bible-topic-${topic.key}`}
                  onClick={() => onOpenTopic(topic)}
                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-hover"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">
                      {titleOf(topic)}
                    </span>
                    <span className="block truncate text-xs text-fg-hint">
                      {subtitleOf(topic)} ·{' '}
                      {t('topics.verseCount', { count: topic.referenceCount })}
                    </span>
                  </span>
                  <ChevronRight
                    className="w-4 h-4 shrink-0 text-fg-hint"
                    strokeWidth={1.5}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
