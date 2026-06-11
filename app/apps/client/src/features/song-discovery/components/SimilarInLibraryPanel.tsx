import { useTranslation } from 'react-i18next'

import type { SongVersionSuggestion } from '~/features/songs/types'

interface SimilarInLibraryPanelProps {
  similar: SongVersionSuggestion[]
}

/**
 * Shows the existing library songs that look like the selected candidate, so
 * the operator can decide whether they're about to import a duplicate. Reuses
 * the same `SongVersionSuggestion` shape as the Versions feature.
 */
export function SimilarInLibraryPanel({ similar }: SimilarInLibraryPanelProps) {
  const { t } = useTranslation('songDiscovery')

  if (similar.length === 0) return null

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
        {t('similar.title', { count: similar.length })}
      </h3>
      <ul className="space-y-2">
        {similar.map((s) => (
          <li
            key={s.songId}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <div className="min-w-0">
              <span className="block truncate text-gray-900 dark:text-white">
                {s.title}
              </span>
              {(s.author || s.categoryName) && (
                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                  {[s.author, s.categoryName].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
            <span className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-300">
              {Math.round(s.score * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
