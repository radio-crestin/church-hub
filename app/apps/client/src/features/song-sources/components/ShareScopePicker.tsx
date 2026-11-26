import { useTranslation } from 'react-i18next'

import { useCategories } from '~/features/songs/hooks'

interface ShareScopePickerProps {
  /** null: the whole library. */
  categoryIds: number[] | null
  onChange: (categoryIds: number[] | null) => void
}

/** What "Share my songs" shares: the whole library, or the categories ticked. */
export function ShareScopePicker({
  categoryIds,
  onChange,
}: ShareScopePickerProps) {
  const { t } = useTranslation('songDiscovery')
  const { data: categories = [] } = useCategories()
  const chosen = new Set(categoryIds ?? [])

  const toggle = (id: number) => {
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...next])
  }

  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">{t('songSources.share.scope')}</legend>
      <label className="flex items-center gap-2 text-sm text-fg">
        <input
          type="radio"
          name="share-scope"
          checked={categoryIds === null}
          onChange={() => onChange(null)}
          className="accent-primary"
        />
        {t('songSources.share.wholeLibrary')}
      </label>
      <label className="flex items-center gap-2 text-sm text-fg">
        <input
          type="radio"
          name="share-scope"
          checked={categoryIds !== null}
          onChange={() => onChange([])}
          className="accent-primary"
        />
        {t('songSources.share.someCategories')}
      </label>
      {categoryIds !== null && (
        <ul
          className="ml-6 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-line p-2"
          data-testid="share-categories"
        >
          {categories.map((category) => (
            <li key={category.id}>
              <label className="flex items-center gap-2 text-sm text-fg-body">
                <input
                  type="checkbox"
                  checked={chosen.has(category.id)}
                  onChange={() => toggle(category.id)}
                  className="accent-primary"
                />
                {category.name}
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}
