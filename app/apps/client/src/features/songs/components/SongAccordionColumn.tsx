import { GripHorizontal } from 'lucide-react'
import { useCallback, useRef } from 'react'

import { useDividerPosition } from '~/hooks/useDividerPosition'
import { DIVIDER_KEYS } from '~/service/layout'
import { SongBookmarksPanel } from './SongBookmarksPanel'
import { SongVersionsPanel } from './SongVersionsPanel'
import type { SongWithSlides } from '../types'

interface SongAccordionColumnProps {
  isLargeScreen: boolean
  /** The song currently open — drives the Versiuni panel and active highlight. */
  song: SongWithSlides
  bookmarksOpen: boolean
  versionsOpen: boolean
  onToggleBookmarks: () => void
  onToggleVersions: () => void
  onSelectBookmarkSong: (bookmark: { songId: number }) => void
  onAddAllBookmarksToSchedule: (songIds: number[]) => void
  canViewSongVersions: boolean
  canAddSongVersion: boolean
  canEditSongVersion: boolean
  canDeleteSongVersion: boolean
  attentionBadge?: string | null
  className?: string
  style?: React.CSSProperties
}

/**
 * The song page's right-hand column: the user's bookmarks (Marcaje) stacked
 * above the similar/related versions (Versiuni), each collapsible, with a
 * draggable divider between them when both are expanded. Shared by the classic
 * song layout and the PowerPoint stage layout so the panel behaves identically
 * in both. The parent owns the column's width and show/hide; this component
 * owns the internal Marcaje ↔ Versiuni split.
 */
export function SongAccordionColumn({
  isLargeScreen,
  song,
  bookmarksOpen,
  versionsOpen,
  onToggleBookmarks,
  onToggleVersions,
  onSelectBookmarkSong,
  onAddAllBookmarksToSchedule,
  canViewSongVersions,
  canAddSongVersion,
  canEditSongVersion,
  canDeleteSongVersion,
  attentionBadge = null,
  className = '',
  style,
}: SongAccordionColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  // Position is the % height given to Marcaje (the top section).
  const [dividerPosition, setDividerPosition] = useDividerPosition(
    DIVIDER_KEYS.songDetailAccordion,
    50,
  )

  // The Marcaje↔Versiuni divider only makes sense when both sections are
  // expanded and visible (Marcaje is hidden below `lg`, Versiuni is gated by
  // the view permission). Otherwise the column falls back to flex behaviour.
  const splitActive =
    isLargeScreen && bookmarksOpen && versionsOpen && canViewSongVersions

  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDragging.current = true
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current || !columnRef.current) return
        const rect = columnRef.current.getBoundingClientRect()
        const newPos = ((moveEvent.clientY - rect.top) / rect.height) * 100
        setDividerPosition(Math.min(80, Math.max(20, newPos)))
      }

      const handleMouseUp = () => {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [setDividerPosition],
  )

  return (
    <div
      ref={columnRef}
      className={`overflow-hidden h-full flex flex-col ${splitActive ? '' : 'gap-2'} ${className}`}
      style={style}
    >
      <div
        className={`hidden lg:block min-h-0 ${
          splitActive ? '' : bookmarksOpen ? 'flex-1' : 'flex-none'
        }`}
        style={
          splitActive
            ? { height: `calc(${dividerPosition}% - 4px)` }
            : undefined
        }
      >
        <SongBookmarksPanel
          onSelectSong={onSelectBookmarkSong}
          activeSongId={song.id}
          onAddAllToSchedule={onAddAllBookmarksToSchedule}
          isCollapsed={!bookmarksOpen}
          onToggleCollapse={onToggleBookmarks}
        />
      </div>

      {splitActive ? (
        <div
          className="hidden lg:flex flex-col items-center justify-center h-2 cursor-row-resize hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded transition-colors group"
          onMouseDown={handleDividerMouseDown}
        >
          <GripHorizontal
            size={16}
            className="text-gray-400 group-hover:text-indigo-500 transition-colors"
          />
        </div>
      ) : null}

      {canViewSongVersions ? (
        <div
          className={`min-h-0 ${
            splitActive ? '' : versionsOpen ? 'flex-1' : 'flex-none'
          }`}
          style={
            splitActive
              ? { height: `calc(${100 - dividerPosition}% - 4px)` }
              : undefined
          }
        >
          <SongVersionsPanel
            songId={song.id}
            songTitle={song.title}
            currentSong={{
              hymnNumber: song.hymnNumber,
              author: song.author,
              keyLine: song.keyLine,
              categoryName: song.category?.name ?? null,
            }}
            canAdd={canAddSongVersion}
            canEdit={canEditSongVersion}
            canDelete={canDeleteSongVersion}
            isCollapsed={!versionsOpen}
            onToggleCollapse={onToggleVersions}
            attentionBadge={attentionBadge}
          />
        </div>
      ) : null}
    </div>
  )
}
