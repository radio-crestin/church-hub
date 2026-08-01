import {
  ChevronRight,
  Eye,
  GripVertical,
  Music2,
  Sparkles,
  Tag,
} from 'lucide-react'
import { forwardRef, useState } from 'react'

import type { SyncChangeKind } from '~/features/sync'
import { SyncUpdateBadge } from '~/features/sync'
import { setSongDragData } from '../utils/songDragData'

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
  /**
   * Lets the card be dragged onto the Marcaje / Programe panels. The song stays
   * in the list — this is a copy-style drag, not a move.
   */
  isDraggable?: boolean
  /** Tooltip for the grip; supplied by the list so it can be translated. */
  dragHandleTitle?: string
}

export const SongCard = forwardRef<HTMLButtonElement, SongCardProps>(
  function SongCard(
    {
      song,
      onClick,
      onMiddleClick,
      isSelected = false,
      showCategoryInTitle,
      syncChangeKind,
      isDraggable = false,
      dragHandleTitle,
    },
    ref,
  ) {
    // Only a press that starts on the grip arms the drag. Without this the
    // whole card is draggable, which turns an ordinary click-and-move into a
    // drag and makes text selection impossible.
    const [dragArmed, setDragArmed] = useState(false)
    const [isDragging, setIsDragging] = useState(false)

    const hasHighlight = song.highlightedTitle?.includes('<mark>')
    const categorySuffix =
      showCategoryInTitle && song.categoryName ? ` (${song.categoryName})` : ''

    return (
      <button
        ref={ref}
        type="button"
        data-testid="song-card"
        draggable={isDraggable && dragArmed}
        onDragStart={
          isDraggable
            ? (e) => {
                setSongDragData(e, { id: song.id, title: song.title })
                setIsDragging(true)
              }
            : undefined
        }
        onDragEnd={
          isDraggable
            ? () => {
                setIsDragging(false)
                setDragArmed(false)
              }
            : undefined
        }
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
        className={`w-full min-w-0 flex items-center justify-between p-4 border rounded-lg hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all text-left group overflow-hidden ${
          isDragging ? 'opacity-40 scale-[0.98]' : ''
        } ${
          isSelected
            ? 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/20 dark:ring-indigo-400/20 bg-indigo-50 dark:bg-indigo-900/20'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }`}
      >
        {/* Grip — the only place a drag can start. Pressing it arms the card's
            native drag, so the ghost is the whole card while an ordinary click
            or text selection anywhere else still behaves normally. */}
        {isDraggable && (
          <span
            role="presentation"
            data-testid="song-card-drag-handle"
            title={dragHandleTitle}
            onPointerDown={() => setDragArmed(true)}
            onPointerUp={() => setDragArmed(false)}
            onPointerLeave={() => {
              if (!isDragging) setDragArmed(false)
            }}
            className="-ml-1 mr-2 flex shrink-0 cursor-grab items-center self-stretch rounded px-1 text-gray-300 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-500 group-hover:opacity-100 active:cursor-grabbing dark:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <GripVertical size={16} />
          </span>
        )}
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
            {syncChangeKind && <SyncUpdateBadge changeKind={syncChangeKind} />}
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
    )
  },
)
