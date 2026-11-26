import { BookOpen } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  useBooks,
  useDefaultBibleTranslation,
  useTranslations,
} from '~/features/bible/hooks'
import { type BibleTopic, useBibleTopics } from '~/features/bible/topics'
import { filterBibleTopics } from '~/features/bible/topics/utils/filterBibleTopics'
import { CountPicker, DEFAULT_PICK_COUNT } from './CountPicker'
import { ItemDialog } from './ItemDialog'
import { SourceTabs } from './SourceTabs'
import type { VersesItemConfig } from './types'

interface VersesItemDialogProps {
  initial?: VersesItemConfig | null
  isSaving: boolean
  onSave: (config: VersesItemConfig) => void
  onClose: () => void
}

const FIELD_CLASS =
  'w-full h-9 px-3 text-[13px] bg-field border-0 rounded-[10px] text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus'

/**
 * A verses item's settings: random verses from a book, or a topic's passages
 * (all in order, or some at random), in a Bible translation.
 */
export function VersesItemDialog({
  initial,
  isSaving,
  onSave,
  onClose,
}: VersesItemDialogProps) {
  const { t, i18n } = useTranslation('schedules')
  const { translation: defaultTranslation } = useDefaultBibleTranslation()
  const { data: translations = [] } = useTranslations()
  const [source, setSource] = useState(initial?.source ?? 'topic')
  const [translationId, setTranslationId] = useState<number | null>(
    initial?.translationId ?? null,
  )
  const [bookCode, setBookCode] = useState(
    initial?.source === 'book' ? initial.bookCode : '',
  )
  const [topicKey, setTopicKey] = useState(
    initial?.source === 'topic' ? initial.topicKey : '',
  )
  const [count, setCount] = useState<number | null>(initial?.count ?? null)
  const [search, setSearch] = useState('')

  const shownTranslationId = translationId ?? defaultTranslation?.id ?? null
  const { data: books = [] } = useBooks(shownTranslationId ?? undefined)
  const { data: topics = [] } = useBibleTopics()

  const readsRomanian = i18n.language.startsWith('ro')
  const titleOf = useCallback(
    (topic: BibleTopic) => (readsRomanian ? topic.titleRo : topic.titleEn),
    [readsRomanian],
  )
  const shownTopics = filterBibleTopics(topics, search, titleOf)
  const pickedTopic = topics.find((topic) => topic.key === topicKey)

  // A whole book is never shown in full: it always takes a number.
  const shownCount = source === 'book' ? (count ?? DEFAULT_PICK_COUNT) : count
  const config: VersesItemConfig | null =
    shownTranslationId === null
      ? null
      : source === 'book'
        ? bookCode
          ? {
              source,
              bookCode,
              translationId: shownTranslationId,
              count: shownCount,
            }
          : null
        : topicKey
          ? { source, topicKey, translationId: shownTranslationId, count }
          : null

  return (
    <ItemDialog
      title={t('mediaItems.verses.title')}
      icon={<BookOpen size={16} strokeWidth={1.5} className="text-fg-label" />}
      testId="verses-item-dialog"
      canSave={config !== null}
      isSaving={isSaving}
      onSave={() => config && onSave(config)}
      onClose={onClose}
    >
      <SourceTabs
        testId="verses-item-source"
        value={source}
        onChange={setSource}
        options={[
          { value: 'topic', label: t('mediaItems.verses.topic') },
          { value: 'book', label: t('mediaItems.verses.book') },
        ]}
      />

      <label className="block space-y-1 text-[13px] text-fg-label">
        <span>{t('mediaItems.verses.translation')}</span>
        <select
          value={shownTranslationId ?? ''}
          onChange={(e) => setTranslationId(Number(e.target.value))}
          className={FIELD_CLASS}
        >
          {translations.map((tr) => (
            <option key={tr.id} value={tr.id}>
              {tr.abbreviation} · {tr.name}
            </option>
          ))}
        </select>
      </label>

      {source === 'book' ? (
        <label className="block space-y-1 text-[13px] text-fg-label">
          <span>{t('mediaItems.verses.book')}</span>
          <select
            value={bookCode}
            data-testid="verses-item-book"
            onChange={(e) => setBookCode(e.target.value)}
            className={FIELD_CLASS}
          >
            <option value="" disabled>
              {t('mediaItems.verses.pickBook')}
            </option>
            {books.map((book) => (
              <option key={book.id} value={book.bookCode}>
                {book.bookName}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="space-y-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('mediaItems.verses.searchTopics')}
            className={FIELD_CLASS}
          />
          {pickedTopic && (
            <p className="text-[13px] text-fg-label">
              {t('mediaItems.verses.pickedTopic', {
                title: titleOf(pickedTopic),
                count: pickedTopic.referenceCount,
              })}
            </p>
          )}
          <div className="max-h-56 space-y-1 overflow-y-auto" role="radiogroup">
            {shownTopics.map((topic) => (
              <button
                key={topic.key}
                type="button"
                role="radio"
                aria-checked={topic.key === topicKey}
                onClick={() => setTopicKey(topic.key)}
                className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] ${
                  topic.key === topicKey
                    ? 'bg-selected text-fg'
                    : 'text-fg-body hover:bg-hover'
                }`}
              >
                <span className="truncate">{titleOf(topic)}</span>
                <span className="shrink-0 text-xs text-fg-hint tabular-nums">
                  {topic.referenceCount}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <CountPicker
        testId="verses-item-count"
        count={shownCount}
        onChange={setCount}
        allowAll={source === 'topic'}
      />
    </ItemDialog>
  )
}
