import { ChevronDown, Tags } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BibleTopicList } from './BibleTopicList'
import { BibleTopicPassages } from './BibleTopicPassages'
import type { BibleVerse } from '../../types'
import { useBibleTopic, useBibleTopics } from '../hooks/useBibleTopics'
import type { BibleTopic } from '../types'

interface BibleTopicsPanelProps {
  /** The Bible page's translation: the verses are shown in it */
  translationId?: number
  activeVerseId?: number
  onPresentVerse: (verse: BibleVerse) => void
  /** Shows the verse in the Bible, selected but not presented */
  onOpenVerse: (verse: BibleVerse) => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

/**
 * Bible verses by topic: search the topics by their Romanian or English
 * title, open one to read its verses, present them one by one.
 */
export function BibleTopicsPanel({
  translationId,
  activeVerseId,
  onPresentVerse,
  onOpenVerse,
  isCollapsed = false,
  onToggleCollapse,
}: BibleTopicsPanelProps) {
  const { t, i18n } = useTranslation('bible')
  const [query, setQuery] = useState('')
  const [openTopic, setOpenTopic] = useState<BibleTopic | null>(null)
  const { data: topics = [], isLoading } = useBibleTopics()
  const topicQuery = useBibleTopic(openTopic?.id ?? null, translationId)

  const readsRomanian = i18n.language.startsWith('ro')
  const titleOf = useCallback(
    (topic: BibleTopic) => (readsRomanian ? topic.titleRo : topic.titleEn),
    [readsRomanian],
  )
  const subtitleOf = useCallback(
    (topic: BibleTopic) => (readsRomanian ? topic.titleEn : topic.titleRo),
    [readsRomanian],
  )

  return (
    <div
      data-testid="bible-topics-panel"
      className="bg-panel rounded-xl border border-line flex flex-col overflow-hidden h-full"
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-line flex-shrink-0">
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? t('topics.expand') : t('topics.collapse')}
            data-testid="bible-topics-collapse"
            className="-ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-fg-hint hover:bg-hover"
          >
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
              strokeWidth={1.75}
            />
          </button>
        ) : null}
        <Tags className="w-4 h-4 text-fg-label" strokeWidth={1.5} />
        <span className="text-sm font-medium text-fg">{t('topics.title')}</span>
        {topics.length > 0 && (
          <span className="text-xs text-fg-hint">({topics.length})</span>
        )}
      </div>

      {isCollapsed ? null : openTopic ? (
        <BibleTopicPassages
          topicId={openTopic.id}
          title={titleOf(openTopic)}
          passages={topicQuery.data?.passages ?? []}
          isLoading={topicQuery.isLoading}
          activeVerseId={activeVerseId}
          onBack={() => setOpenTopic(null)}
          onPresentVerse={onPresentVerse}
          onOpenVerse={onOpenVerse}
        />
      ) : (
        <BibleTopicList
          topics={topics}
          isLoading={isLoading}
          query={query}
          onQueryChange={setQuery}
          titleOf={titleOf}
          subtitleOf={subtitleOf}
          onOpenTopic={setOpenTopic}
        />
      )}
    </div>
  )
}
