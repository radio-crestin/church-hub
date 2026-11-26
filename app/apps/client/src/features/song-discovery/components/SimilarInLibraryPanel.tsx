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
    <li className="rounded-lg px-2 py-1.5 hover:bg-hover">
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="min-w-0">
          <span className="block truncate font-medium text-fg">
            {suggestion.title}
          </span>
          {(suggestion.author || suggestion.categoryName) && (
            <span className="block truncate text-xs text-fg-hint">
              {[suggestion.author, suggestion.categoryName]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-fg-hint tabular-nums">
            {Math.round(suggestion.score * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-fg-label transition-colors hover:bg-selected hover:text-fg"
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
          <div className="mt-2 flex items-center gap-2 text-xs text-fg-hint">
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
    <div className="rounded-xl border border-line bg-panel p-3">
      <h3 className="mb-1.5 px-2 text-sm font-medium text-fg">
        {t('similar.title', { count: similar.length })}
      </h3>
      <ul className="space-y-0.5">
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
