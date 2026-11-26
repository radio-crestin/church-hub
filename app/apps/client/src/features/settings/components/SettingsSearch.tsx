import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { ClearSearchButton } from '~/ui/search'
import type { SettingsNavGroupDef } from '../registry'
import { highlightSetting } from '../search/highlightSetting'
import {
  type SettingsSearchResult,
  searchSettings,
} from '../search/searchSettings'

interface SettingsSearchProps {
  groups: SettingsNavGroupDef[]
  query: string
  onQueryChange: (query: string) => void
}

/**
 * The search box over the settings rail. While it holds a query the rail
 * shows the matching pages and settings; choosing one opens its page and
 * highlights the setting there.
 */
export function SettingsSearch({
  groups,
  query,
  onQueryChange,
}: SettingsSearchProps) {
  const { t, i18n } = useTranslation('settings')
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const results = searchSettings(groups, query, t, i18n.getFixedT('en'))

  const open = async (result: SettingsSearchResult) => {
    await navigate({ to: result.to })
    if (result.setting) highlightSetting(result.setting)
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          strokeWidth={1.5}
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-hint"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) open(results[0])
            if (e.key === 'Escape') onQueryChange('')
          }}
          placeholder={t('nav.search.placeholder')}
          aria-label={t('nav.search.placeholder')}
          data-testid="settings-search"
          className={`h-8 w-full rounded-[10px] bg-field pl-9 text-[13px] text-fg outline-none placeholder:text-fg-hint focus:ring-1 focus:ring-inset focus:ring-focus ${
            query ? 'pr-9' : 'pr-3'
          }`}
        />
        {query && (
          <ClearSearchButton
            inputRef={inputRef}
            onClear={() => onQueryChange('')}
          />
        )}
      </div>

      {query.trim() && (
        <ul className="space-y-0.5" data-testid="settings-search-results">
          {results.map((result) => (
            <li key={`${result.to}|${result.label}`}>
              <button
                type="button"
                onClick={() => open(result)}
                className="w-full rounded-lg px-2.5 py-1.5 text-left text-fg-label transition-colors hover:bg-hover hover:text-fg"
              >
                <span className="block text-[13px] font-medium">
                  {result.label}
                </span>
                <span className="block truncate text-xs text-fg-hint">
                  {result.path}
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-2.5 py-1.5 text-[13px] text-fg-hint">
              {t('nav.search.noResults', { query: query.trim() })}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
