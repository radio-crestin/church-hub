import { GripHorizontal } from 'lucide-react'
import { useCallback, useRef } from 'react'

import type { ScheduleItem } from '~/features/schedules'
import { SchedulePanel } from '~/features/schedules'
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
  schedulesOpen: boolean
  versionsOpen: boolean
  onToggleBookmarks: () => void
  onToggleSchedules: () => void
  onToggleVersions: () => void
  onSelectBookmarkSong: (bookmark: { songId: number }) => void
  onSelectScheduleSong: (songId: number) => void
  /** Jumps to the Bible page when a program's verse row is clicked. */
  onSelectSchedulePassage: (item: ScheduleItem) => void
  onOpenSchedule: (scheduleId: number) => void
  onAddAllBookmarksToSchedule: () => void
  canViewSongVersions: boolean
  canAddSongVersion: boolean
  canEditSongVersion: boolean
  canDeleteSongVersion: boolean
  canViewSchedules: boolean
  attentionBadge?: string | null
  className?: string
  style?: React.CSSProperties
}

/**
 * The song page's right-hand column: the user's bookmarks (Marcaje), the songs
 * of a chosen program (Programe) and the similar/related versions (Versiuni),
 * each collapsible. Shared by the classic song layout and the PowerPoint stage
 * layout so the panels behave identically in both. The parent owns the column's
 * width and show/hide; this component owns the internal split.
 *
 * The draggable Marcaje ↔ Versiuni divider is preserved for the two-section
 * case (its position is persisted and operators rely on it). As soon as the
 * Programe section is expanded the column falls back to plain flex
 * distribution, which keeps three sections legible without a second divider.
 */
export function SongAccordionColumn({
  isLargeScreen,
  song,
  bookmarksOpen,
  schedulesOpen,
  versionsOpen,
  onToggleBookmarks,
  onToggleSchedules,
  onToggleVersions,
  onSelectBookmarkSong,
  onSelectScheduleSong,
  onSelectSchedulePassage,
  onOpenSchedule,
  onAddAllBookmarksToSchedule,
  canViewSongVersions,
  canAddSongVersion,
  canEditSongVersion,
  canDeleteSongVersion,
  canViewSchedules,
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

  // The Marcaje↔Versiuni divider only makes sense when exactly those two
  // sections are expanded and visible (Marcaje is hidden below `lg`, Versiuni is
  // gated by the view permission, Programe would be a third section between
  // them). Otherwise the column falls back to flex behaviour.
  const schedulesVisible = isLargeScreen && canViewSchedules
  const splitActive =
    isLargeScreen &&
    bookmarksOpen &&
    versionsOpen &&
    canViewSongVersions &&
    !(schedulesVisible && schedulesOpen)

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

      {canViewSchedules ? (
        <div
          className={`hidden lg:block min-h-0 ${
            schedulesOpen ? 'flex-1' : 'flex-none'
          }`}
        >
          <SchedulePanel
            activeSongId={song.id}
            onSelectSong={onSelectScheduleSong}
            onSelectPassage={onSelectSchedulePassage}
            onOpenSchedule={onOpenSchedule}
            candidateSong={{ id: song.id, title: song.title }}
            onAddAllBookmarks={onAddAllBookmarksToSchedule}
            isCollapsed={!schedulesOpen}
            onToggleCollapse={onToggleSchedules}
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
