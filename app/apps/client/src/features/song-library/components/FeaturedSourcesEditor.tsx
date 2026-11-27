import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import { useFeaturedSources } from '../hooks/useFeaturedSources'
import type { FeaturedSource } from '../types'

const EMPTY_DRAFT = { sourceId: '', name: '', categoryName: '' }

/**
 * The song sources every app is offered (Church Hub's featured list): the
 * libraries it manages, in order. Each must be published first
 * (scripts/publish-library.ts, or the curated library itself).
 */
export function FeaturedSourcesEditor() {
  const { t } = useTranslation('songLibrary')
  const { query, save } = useFeaturedSources(true)
  const [sources, setSources] = useState<FeaturedSource[]>([])
  const [draft, setDraft] = useState(EMPTY_DRAFT)

  useEffect(() => {
    if (query.data) setSources(query.data)
  }, [query.data])

  const move = (index: number, by: number) => {
    const next = [...sources]
    const [item] = next.splice(index, 1)
    if (item) next.splice(index + by, 0, item)
    setSources(next)
  }
  const canAdd =
    /^[A-Za-z0-9_-]{1,128}$/.test(draft.sourceId) &&
    draft.name.trim() !== '' &&
    draft.categoryName.trim() !== '' &&
    !sources.some((source) => source.sourceId === draft.sourceId)

  return (
    <section className="space-y-2" data-testid="featured-sources">
      <h3 className="text-sm font-semibold text-fg">{t('featured.title')}</h3>
      <p className="text-xs text-fg-hint">{t('featured.description')}</p>
      {sources.length === 0 && (
        <p className="text-sm text-fg-hint">{t('featured.empty')}</p>
      )}
      <ol className="space-y-1">
        {sources.map((source, index) => (
          <li
            key={source.sourceId}
            className="flex items-center gap-2 rounded-lg border border-line px-3 py-2"
            data-testid="featured-source"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-fg">
                {source.name}
              </span>
              <span className="block truncate text-xs text-fg-hint">
                {source.sourceId} · {source.categoryName}
              </span>
            </span>
            <button
              type="button"
              disabled={index === 0}
              onClick={() => move(index, -1)}
              aria-label={t('featured.up', { name: source.name })}
              className="rounded p-1 text-fg-hint hover:text-fg disabled:opacity-30"
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              disabled={index === sources.length - 1}
              onClick={() => move(index, 1)}
              aria-label={t('featured.down', { name: source.name })}
              className="rounded p-1 text-fg-hint hover:text-fg disabled:opacity-30"
            >
              <ArrowDown size={14} />
            </button>
            <button
              type="button"
              onClick={() =>
                setSources(sources.filter((other) => other !== source))
              }
              aria-label={t('featured.remove', { name: source.name })}
              className="rounded p-1 text-fg-hint hover:text-fg"
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ol>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <Input
          value={draft.sourceId}
          onChange={(event) =>
            setDraft({ ...draft, sourceId: event.target.value.trim() })
          }
          placeholder={t('featured.sourceId')}
          aria-label={t('featured.sourceId')}
          data-testid="featured-source-id"
        />
        <Input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          placeholder={t('featured.name')}
          aria-label={t('featured.name')}
          data-testid="featured-source-name"
        />
        <Input
          value={draft.categoryName}
          onChange={(event) =>
            setDraft({ ...draft, categoryName: event.target.value })
          }
          placeholder={t('featured.category')}
          aria-label={t('featured.category')}
          data-testid="featured-source-category"
        />
        <Button
          size="md"
          variant="outline"
          disabled={!canAdd}
          onClick={() => {
            setSources([
              ...sources,
              {
                sourceId: draft.sourceId,
                name: draft.name.trim(),
                categoryName: draft.categoryName.trim(),
                description: null,
                homepage: null,
                license: null,
              },
            ])
            setDraft(EMPTY_DRAFT)
          }}
          data-testid="featured-source-add"
        >
          <Plus strokeWidth={1.5} className="h-4 w-4" />
          {t('featured.add')}
        </Button>
      </div>
      <Button
        size="sm"
        disabled={save.isPending || query.isLoading}
        onClick={() => save.mutate(sources)}
        data-testid="featured-sources-save"
      >
        {t('featured.save')}
      </Button>
    </section>
  )
}
