import {
  Bookmark,
  BookmarkCheck,
  CalendarPlus,
  ChevronRight,
  Eye,
  Music2,
  Sparkles,
  Tag,
} from 'lucide-react'
import { forwardRef } from 'react'

import type { SyncChangeKind } from '~/features/sync'
import { SyncUpdateBadge } from '~/features/sync'

interface SongCardProps {
  song: {
    id: number
    title: string
    categoryId: number | null
    categoryName: string | null
    keyLine?: string | null
    highlightedTitle?: string
    matchedContent?: string
    presentationCount?: number
    aiRelevanceScore?: number
    score?: number
    tagNames?: string[]
  }
  onClick: () => void
  onMiddleClick?: () => void
  isSelected?: boolean
  showCategoryInTitle?: boolean
  /** Unseen sync change applied from another device (renders a badge). */
  syncChangeKind?: SyncChangeKind
  /** The song already sits in Marcaje — flips the bookmark button's state. */
  isBookmarked?: boolean
  /**
   * Marks / unmarks the song. Omitted (pickers, embedded lists) hides the
   * button entirely.
   */
  onToggleBookmark?: () => void
  /** Adds the song to a program. Omitted hides the button. */
  onAddToSchedule?: () => void
  /** Accessible name for the bookmark button; the list translates it. */
  bookmarkLabel?: string
  /** Accessible name for the add-to-program button. */
  addToScheduleLabel?: string
}

export const SongCard = forwardRef<HTMLDivElement, SongCardProps>(
  function SongCard(
    {
      song,
      onClick,
      onMiddleClick,
      isSelected = false,
      showCategoryInTitle,
      syncChangeKind,
      isBookmarked = false,
      onToggleBookmark,
      onAddToSchedule,
      bookmarkLabel,
      addToScheduleLabel,
    },
    ref,
  ) {
    const hasHighlight = song.highlightedTitle?.includes('<mark>')
    const categorySuffix =
      showCategoryInTitle && song.categoryName ? ` (${song.categoryName})` : ''
    const hasRowActions = !!onToggleBookmark || !!onAddToSchedule

    return (
      // A row, not one big button: the two actions are real buttons and must
      // not be nested inside the one that opens the song. Same shape the
      // Marcaje and program rows already use.
      <div
        ref={ref}
        data-testid="song-card"
        className={`w-full min-w-0 flex items-center border rounded-lg hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all group overflow-hidden ${
          isSelected
            ? 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/20 dark:ring-indigo-400/20 bg-indigo-50 dark:bg-indigo-900/20'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }`}
      >
        <button
          type="button"
          data-testid="song-card-open"
          onClick={(e) => {
            // CMD+click (Mac) or Ctrl+click (Windows/Linux) opens in new window
            if ((e.metaKey || e.ctrlKey) && onMiddleClick) {
              e.preventDefault()
              onMiddleClick()
              return
            }
            onClick()
          }}
          onAuxClick={(e) => {
            if (e.button === 1 && onMiddleClick) {
              e.preventDefault()
              onMiddleClick()
            }
          }}
          className={`flex-1 min-w-0 flex items-center justify-between py-4 pl-4 text-left ${
            hasRowActions ? 'pr-2' : 'pr-4'
          }`}
        >
          <div className="flex-1 min-w-0">
            {hasHighlight ? (
              <h3 className="font-medium text-gray-900 dark:text-white truncate">
                <span
                  className="[&_mark]:bg-yellow-300 [&_mark]:dark:bg-yellow-400/60 [&_mark]:rounded-sm [&_mark]:px-0.5"
                  dangerouslySetInnerHTML={{
                    __html: song.highlightedTitle!,
                  }}
                />
                {categorySuffix && (
                  <span className="text-gray-400 dark:text-gray-500 font-normal">
                    {categorySuffix}
                  </span>
                )}
              </h3>
            ) : (
              <h3 className="font-medium text-gray-900 dark:text-white truncate">
                {song.title}
                {categorySuffix && (
                  <span className="text-gray-400 dark:text-gray-500 font-normal">
                    {categorySuffix}
                  </span>
                )}
              </h3>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {syncChangeKind && (
                <SyncUpdateBadge changeKind={syncChangeKind} />
              )}
              {song.categoryName && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                  <Tag className="w-3 h-3" />
                  {song.categoryName}
                </span>
              )}
              {song.tagNames?.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded"
                >
                  {name}
                </span>
              ))}
              {song.presentationCount !== undefined &&
                song.presentationCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 rounded">
                    <Eye className="w-3 h-3" />
                    {song.presentationCount}
                  </span>
                )}
              {song.aiRelevanceScore !== undefined && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded">
                  <Sparkles className="w-3 h-3" />
                  {song.aiRelevanceScore}%
                </span>
              )}
              {song.score !== undefined && song.score > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 rounded">
                  <Sparkles className="w-3 h-3" />
                  {song.score}
                </span>
              )}
              {song.keyLine && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded">
                  <Music2 className="w-3 h-3" />
                  {song.keyLine}
                </span>
              )}
            </div>
            {song.matchedContent && (
              <p
                className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 [&_mark]:bg-yellow-300 [&_mark]:dark:bg-yellow-400/60 [&_mark]:rounded-sm [&_mark]:px-0.5"
                dangerouslySetInnerHTML={{ __html: song.matchedContent }}
              />
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors flex-shrink-0 ml-2" />
        </button>

        {/* Marcaje / Programe, one press each. Always rendered rather than
            revealed on hover: a phone has no hover, and these are the two
            actions the operator reaches for while running a service. */}
        {hasRowActions && (
          <div className="flex shrink-0 items-center gap-1 pr-2">
            {onToggleBookmark && (
              <button
                type="button"
                data-testid="song-card-bookmark"
                aria-label={bookmarkLabel}
                title={bookmarkLabel}
                aria-pressed={isBookmarked}
                onClick={onToggleBookmark}
                className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                  isBookmarked
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'text-gray-400 hover:bg-amber-50 hover:text-amber-600 dark:text-gray-500 dark:hover:bg-amber-900/30 dark:hover:text-amber-300'
                }`}
              >
                {isBookmarked ? (
                  <BookmarkCheck className="w-4 h-4" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
              </button>
            )}
            {onAddToSchedule && (
              <button
                type="button"
                data-testid="song-card-add-to-schedule"
                aria-label={addToScheduleLabel}
                title={addToScheduleLabel}
                onClick={onAddToSchedule}
                className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600 dark:text-gray-500 dark:hover:bg-green-900/30 dark:hover:text-green-300"
              >
                <CalendarPlus className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    )
  },
)
