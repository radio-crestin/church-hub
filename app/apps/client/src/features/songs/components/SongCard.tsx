import { Bookmark, CalendarPlus, Eye, Sparkles } from 'lucide-react'
import { forwardRef, useRef } from 'react'

import type { SyncChangeKind } from '~/features/sync'
import { SyncUpdateBadge } from '~/features/sync'
import { HighlightedText } from '~/ui/search'
import { startSongDrag } from '../utils/songDragController'

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
    // Set the moment a press on the row becomes a drag, so the click the
    // browser sends afterwards does not also open the song.
    const draggedOut = useRef(false)
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
        className={`w-full min-w-0 flex items-center rounded-lg transition-colors duration-150 group overflow-hidden ${
          isSelected ? 'bg-selected' : 'hover:bg-hover'
        }`}
      >
        <button
          type="button"
          data-testid="song-card-open"
          onPointerDown={(e) =>
            startSongDrag(e, { id: song.id, title: song.title }, () => {
              draggedOut.current = true
            })
          }
          onClick={(e) => {
            // The row is also what an operator carries over to Marcaje or a
            // program. Once that gesture has armed, the click the browser
            // sends when the pointer comes back up is not a click on the song.
            if (draggedOut.current) {
              draggedOut.current = false
              return
            }
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
          className={`flex-1 min-w-0 flex items-center justify-between py-2 pl-3 md:py-2.5 text-left ${
            hasRowActions ? 'pr-2' : 'pr-4'
          }`}
        >
          <div className="flex-1 min-w-0">
            {hasHighlight ? (
              <h3 className="text-[13px] font-medium text-fg truncate">
                <span
                  data-testid="song-card-title"
                  className="[&_mark]:bg-yellow-300 [&_mark]:dark:bg-yellow-400/60 [&_mark]:rounded-sm [&_mark]:px-0.5"
                >
                  <HighlightedText text={song.highlightedTitle!} />
                </span>
                {categorySuffix && (
                  <span className="text-fg-hint font-normal">
                    {categorySuffix}
                  </span>
                )}
              </h3>
            ) : (
              <h3 className="text-[13px] font-medium text-fg truncate">
                {song.title}
                {categorySuffix && (
                  <span className="text-fg-hint font-normal">
                    {categorySuffix}
                  </span>
                )}
              </h3>
            )}
            <div className="flex items-center gap-2 mt-1 md:mt-1.5 flex-wrap">
              {syncChangeKind && (
                <SyncUpdateBadge changeKind={syncChangeKind} />
              )}
              {song.categoryName && (
                <span className="text-xs text-fg-hint">
                  {song.categoryName}
                </span>
              )}
              {song.tagNames?.map((name) => (
                <span key={name} className="text-xs text-fg-label">
                  {name}
                </span>
              ))}
              {song.presentationCount !== undefined &&
                song.presentationCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-fg-hint tabular-nums">
                    <Eye className="w-3 h-3" />
                    {song.presentationCount}
                  </span>
                )}
              {song.aiRelevanceScore !== undefined && (
                <span className="inline-flex items-center gap-1 text-xs text-fg-hint tabular-nums">
                  <Sparkles className="w-3 h-3" />
                  {song.aiRelevanceScore}%
                </span>
              )}
              {song.score !== undefined && song.score > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-fg-hint tabular-nums">
                  <Sparkles className="w-3 h-3" />
                  {song.score}
                </span>
              )}
              {song.keyLine && (
                <span className="text-xs font-medium text-key">
                  {song.keyLine}
                </span>
              )}
            </div>
            {song.matchedContent && (
              <p
                data-testid="song-card-snippet"
                className="text-sm text-fg-hint mt-1 line-clamp-2 [&_mark]:bg-yellow-300 [&_mark]:dark:bg-yellow-400/60 [&_mark]:rounded-sm [&_mark]:px-0.5"
              >
                <HighlightedText text={song.matchedContent} />
              </p>
            )}
          </div>
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
                    ? 'text-bookmark hover:bg-hover'
                    : 'text-fg-hint hover:bg-hover hover:text-fg'
                }`}
              >
                {/* Marked reads as a filled-in bookmark, not a coloured tile:
                    the row is a list item, not a toolbar. */}
                <Bookmark
                  className="w-4 h-4"
                  fill={isBookmarked ? 'currentColor' : 'none'}
                />
              </button>
            )}
            {onAddToSchedule && (
              <button
                type="button"
                data-testid="song-card-add-to-schedule"
                aria-label={addToScheduleLabel}
                title={addToScheduleLabel}
                onClick={onAddToSchedule}
                className="flex h-8 w-8 items-center justify-center rounded-md text-fg-hint transition-colors hover:bg-hover hover:text-fg"
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
