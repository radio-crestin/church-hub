import { ChevronDown, ChevronRight, GitCompare, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSong } from '~/features/songs/hooks'
import type { SongVersionSuggestion } from '~/features/songs/types'
import { LyricsDiffView } from './LyricsDiffView'
import { slidesToLines } from '../utils/lyricsDiff'

interface SimilarInLibraryPanelProps {
  similar: SongVersionSuggestion[]
  /** The candidate's (edited) lyric lines, for the GitHub-style diff. */
  candidateLines: string[]
}

/** One similar-library-song row with an expandable lyrics diff. */
function SimilarRow({
  suggestion,
  candidateLines,
}: {
  suggestion: SongVersionSuggestion
  candidateLines: string[]
}) {
  const { t } = useTranslation('songDiscovery')
  const [open, setOpen] = useState(false)
  // Fetch the library song's slides only when the diff is opened.
  const { data: song, isLoading } = useSong(open ? suggestion.songId : null)
  const libraryLines = useMemo(
    () => (song ? slidesToLines(song.slides) : []),
    [song],
  )

  return (
    <li className="rounded-md bg-white/60 px-2 py-1.5 dark:bg-gray-900/40">
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="min-w-0">
          <span className="block truncate text-gray-900 dark:text-white">
            {suggestion.title}
          </span>
          {(suggestion.author || suggestion.categoryName) && (
            <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
              {[suggestion.author, suggestion.categoryName]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
            {Math.round(suggestion.score * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
          >
            {open ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <GitCompare className="h-3 w-3" />
            {open ? t('diff.hide') : t('diff.show')}
          </button>
        </div>
      </div>
      {open &&
        (isLoading || !song ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('diff.loading')}
          </div>
        ) : (
          <LyricsDiffView
            libraryLines={libraryLines}
            candidateLines={candidateLines}
          />
        ))}
    </li>
  )
}

/**
 * Shows the existing library songs that look like the selected candidate, so
 * the operator can decide whether they're about to import a duplicate. Each row
 * expands into a GitHub-style lyrics diff (existing vs. catalog version).
 */
export function SimilarInLibraryPanel({
  similar,
  candidateLines,
}: SimilarInLibraryPanelProps) {
  const { t } = useTranslation('songDiscovery')

  if (similar.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
      <h3 className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
        {t('similar.title', { count: similar.length })}
      </h3>
      <ul className="space-y-1.5">
        {similar.map((s) => (
          <SimilarRow
            key={s.songId}
            suggestion={s}
            candidateLines={candidateLines}
          />
        ))}
      </ul>
    </div>
  )
}
