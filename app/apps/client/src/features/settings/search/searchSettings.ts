import type { TFunction } from 'i18next'

import { normalizeForSearch } from '~/utils/normalizeForSearch'
import type { SettingsNavGroupDef } from '../registry'

export interface SettingsSearchResult {
  /** The setting's label, or the page's when the page itself matched. */
  label: string
  /** "Group › Page", where the result lives. */
  path: string
  to: string
  /** Set when the result is a setting on the page, to highlight it there. */
  setting?: string
}

/**
 * Finds the pages and settings whose labels contain every word of `query`,
 * ignoring case and diacritics. A label matches in the app's language or in
 * English (`tEnglish`), as many type "debug" or "backup" whatever the language.
 * Pages come before their settings.
 */
export function searchSettings(
  groups: SettingsNavGroupDef[],
  query: string,
  t: TFunction,
  tEnglish: TFunction,
): SettingsSearchResult[] {
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const matches = (key: string) =>
    [t(key), tEnglish(key)].some((text) => {
      const folded = normalizeForSearch(text)
      return words.every((word) => folded.includes(word))
    })

  const results: SettingsSearchResult[] = []
  for (const group of groups) {
    const groupLabel = t(`settings:${group.labelKey}`)
    for (const item of group.items) {
      const pageKey = `settings:${item.labelKey}`
      const pageLabel = t(pageKey)
      const path = `${groupLabel} › ${pageLabel}`
      if (matches(pageKey))
        results.push({ label: pageLabel, path, to: item.to })
      const seen = new Set([pageLabel])
      for (const key of item.settings ?? []) {
        const label = t(key)
        if (seen.has(label) || !matches(key)) continue
        seen.add(label)
        results.push({ label, path, to: item.to, setting: label })
      }
    }
  }
  return results
}
