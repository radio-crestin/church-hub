import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Bookmark,
  Check,
  ChevronDown,
  Download,
  GripVertical,
  Pencil,
  Plus,
  Search,
  StickyNote,
  Trash2,
  X as XIcon,
} from 'lucide-react'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ClearSearchButton } from '~/ui/search'
import { normalizeForSearch } from '~/utils/normalizeForSearch'
import {
  useAddBookmark,
  useAddBookmarkNote,
  useBookmarkNotes,
  useClearBookmarks,
  useExportBookmarksAsText,
  useMarkBookmarkSung,
  useRemoveBookmark,
  useRemoveBookmarkNote,
  useReorderBookmarkItems,
  useSongBookmarks,
  useUpdateBookmarkNote,
} from '../hooks'
import { useSongDropZone } from '../hooks/useSongDropZone'
import type { BookmarkNote, SongBookmark } from '../service'

// Unified item type for the bookmark list
interface BookmarkListItem {
  uniqueId: string
  type: 'song' | 'note'
  sortOrder: number
  bookmark?: SongBookmark
  note?: BookmarkNote
}

interface SortableBookmarkItemProps {
  bookmark: SongBookmark
  isActive: boolean
  onSelect: () => void
  onRemove: () => void
  onToggleSung: () => void
}

function SortableBookmarkItem({
  bookmark,
  isActive,
  onSelect,
  onRemove,
  onToggleSung,
}: SortableBookmarkItemProps) {
  const { t } = useTranslation('songs')
  const uniqueId = `song-${bookmark.id}`
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: uniqueId })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(
      transform ? { ...transform, scaleX: 1, scaleY: 1 } : null,
    ),
    transition: isDragging ? 'none' : (transition ?? undefined),
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? 'relative' : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid="bookmark-item"
      className={`flex items-center gap-1 rounded-lg border transition-colors ${
        isDragging
          ? 'opacity-80 shadow-lg border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/20'
          : isActive
            ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/20'
            : bookmark.isSung
              ? 'border-green-200 dark:border-green-800/60 bg-green-50/50 dark:bg-green-900/10 hover:border-green-300 dark:hover:border-green-700'
              : 'border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-600 bg-white dark:bg-gray-800 hover:bg-amber-50/50 dark:hover:bg-amber-900/10'
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        data-testid="bookmark-drag-handle"
        className="flex-shrink-0 p-1.5 cursor-grab active:cursor-grabbing rounded-l-lg hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <GripVertical size={14} className="text-gray-400 dark:text-gray-500" />
      </div>

      <button
        type="button"
        onClick={onToggleSung}
        aria-pressed={bookmark.isSung}
        title={
          bookmark.isSung ? t('bookmarks.markNotSung') : t('bookmarks.markSung')
        }
        data-testid="bookmark-sung-toggle"
        className={`flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
          bookmark.isSung
            ? 'border-green-500 bg-green-500 text-white'
            : 'border-gray-300 dark:border-gray-600 text-transparent hover:border-green-400 hover:text-green-400'
        }`}
      >
        <Check size={12} strokeWidth={3} />
      </button>

      <button
        type="button"
        onClick={onSelect}
        className="flex-1 min-w-0 text-left py-1.5 pr-1"
      >
        <div className="text-sm font-medium truncate text-gray-900 dark:text-white">
          {bookmark.songTitle}
        </div>
        {(bookmark.songCategoryName || bookmark.songKeyLine) && (
          <div className="flex items-center gap-2 mt-0.5">
            {bookmark.songCategoryName && (
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {bookmark.songCategoryName}
              </span>
            )}
            {bookmark.songKeyLine && (
              <span
                className="text-xs text-amber-600 dark:text-amber-400 shrink-0"
                data-testid="bookmark-key-line"
              >
                {bookmark.songKeyLine}
              </span>
            )}
          </div>
        )}
        {bookmark.songTagNames?.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {bookmark.songTagNames.map((name) => (
              <span
                key={name}
                className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium leading-none bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded"
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-r-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        title="Remove"
      >
        <XIcon size={14} />
      </button>
    </div>
  )
}

interface SortableNoteItemProps {
  note: BookmarkNote
  onUpdate: (content: string) => void
  onRemove: () => void
}

function SortableNoteItem({ note, onUpdate, onRemove }: SortableNoteItemProps) {
  const { t } = useTranslation('songs')
  const uniqueId = `note-${note.id}`
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(note.content)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: uniqueId })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(
      transform ? { ...transform, scaleX: 1, scaleY: 1 } : null,
    ),
    transition: isDragging ? 'none' : (transition ?? undefined),
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? 'relative' : undefined,
  }

  const handleSave = () => {
    const trimmed = editContent.trim()
    if (trimmed && trimmed !== note.content) {
      onUpdate(trimmed)
    }
    setIsEditing(false)
  }

  const handleStartEdit = () => {
    setEditContent(note.content)
    setIsEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1 rounded-lg border transition-colors ${
        isDragging
          ? 'opacity-80 shadow-lg border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 hover:border-blue-300 dark:hover:border-blue-700'
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        data-testid="bookmark-note-drag-handle"
        className="flex-shrink-0 p-1.5 cursor-grab active:cursor-grabbing rounded-l-lg hover:bg-blue-100 dark:hover:bg-blue-900/30"
      >
        <GripVertical size={14} className="text-blue-400 dark:text-blue-500" />
      </div>

      {isEditing ? (
        <div className="flex-1 min-w-0 flex items-center gap-1 py-1 pr-1">
          <input
            ref={inputRef}
            type="text"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') setIsEditing(false)
            }}
            className="flex-1 min-w-0 text-xs bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-600 rounded px-2 py-1 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="button"
            onClick={handleSave}
            className="p-1 text-green-600 hover:text-green-700 dark:text-green-400"
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XIcon size={14} />
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 min-w-0 py-1.5 pr-1 flex items-center gap-1.5">
            <StickyNote
              size={12}
              className="flex-shrink-0 text-blue-400 dark:text-blue-500"
            />
            <span className="text-xs text-blue-700 dark:text-blue-300 italic truncate">
              {note.content}
            </span>
          </div>

          <button
            type="button"
            onClick={handleStartEdit}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
            title={t('bookmarks.editNote')}
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-r-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title={t('bookmarks.deleteNote')}
          >
            <XIcon size={14} />
          </button>
        </>
      )}
    </div>
  )
}

interface SongBookmarksPanelProps {
  onSelectSong: (bookmark: SongBookmark) => void
  activeSongId?: number
  /**
   * Accepts songs dragged in from the song list. The song stays in the list —
   * dropping here only bookmarks it.
   */
  acceptsSongDrop?: boolean
  /**
   * When provided, renders a chevron toggle inline with the title so the
   * panel can act as its own accordion section without a wrapping
   * CollapsibleSection (which used to introduce a redundant header bar).
   * The body is hidden when `isCollapsed` is true; the header keeps its
   * actions visible so the operator still gets at Add/Export/Schedule/Clear.
   */
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export function SongBookmarksPanel({
  onSelectSong,
  activeSongId,
  acceptsSongDrop = false,
  isCollapsed = false,
  onToggleCollapse,
}: SongBookmarksPanelProps) {
  const { t } = useTranslation('songs')
  const { data: bookmarks = [], isLoading } = useSongBookmarks()
  const { data: notes = [] } = useBookmarkNotes()
  const clearBookmarksMutation = useClearBookmarks()
  const addBookmarkMutation = useAddBookmark()
  const removeBookmarkMutation = useRemoveBookmark()
  const markSungMutation = useMarkBookmarkSung()
  const reorderItemsMutation = useReorderBookmarkItems()
  const addNoteMutation = useAddBookmarkNote()
  const updateNoteMutation = useUpdateBookmarkNote()
  const removeNoteMutation = useRemoveBookmarkNote()
  const exportMutation = useExportBookmarksAsText()
  const [searchQuery, setSearchQuery] = useState('')
  // Filter the song bookmarks by their "already sung" state.
  const [sungFilter, setSungFilter] = useState<'all' | 'sung' | 'pending'>(
    'all',
  )
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')
  const newNoteInputRef = useRef<HTMLInputElement>(null)
  // Local order override for instant (synchronous) drag feedback
  const [localOrder, setLocalOrder] = useState<BookmarkListItem[] | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // Merge bookmarks and notes into a unified sorted list from server data
  const serverItems = useMemo<BookmarkListItem[]>(() => {
    const items: BookmarkListItem[] = [
      ...bookmarks.map((b) => ({
        uniqueId: `song-${b.id}`,
        type: 'song' as const,
        sortOrder: b.sortOrder,
        bookmark: b,
      })),
      ...notes.map((n) => ({
        uniqueId: `note-${n.id}`,
        type: 'note' as const,
        sortOrder: n.sortOrder,
        note: n,
      })),
    ]
    return items.sort((a, b) => a.sortOrder - b.sortOrder)
  }, [bookmarks, notes])

  // Use local order if set (during drag), otherwise use server data
  const unifiedItems = localOrder ?? serverItems

  const filteredItems = useMemo(() => {
    // Folded on both sides so "cantare" finds "cântare" and vice versa.
    const q = normalizeForSearch(searchQuery.trim())
    return unifiedItems.filter((item) => {
      // Sung filter applies to song bookmarks only; notes show only in "all".
      if (sungFilter !== 'all') {
        if (item.type !== 'song') return false
        const sung = item.bookmark?.isSung ?? false
        if (sungFilter === 'sung' && !sung) return false
        if (sungFilter === 'pending' && sung) return false
      }
      if (!q) return true
      if (item.type === 'note') {
        return normalizeForSearch(item.note?.content ?? '').includes(q)
      }
      const b = item.bookmark
      return (
        normalizeForSearch(b?.songTitle ?? '').includes(q) ||
        normalizeForSearch(b?.songCategoryName ?? '').includes(q) ||
        normalizeForSearch(b?.songKeyLine ?? '').includes(q) ||
        b?.songTagNames?.some((name) => normalizeForSearch(name).includes(q))
      )
    })
  }, [unifiedItems, searchQuery, sungFilter])

  // Counts for the filter chips (song bookmarks only).
  const sungCount = useMemo(
    () => bookmarks.filter((b) => b.isSung).length,
    [bookmarks],
  )
  const pendingCount = bookmarks.length - sungCount

  const handleToggleSung = useCallback(
    (bookmark: SongBookmark) => {
      markSungMutation.mutate({
        bookmarkId: bookmark.id,
        isSung: !bookmark.isSung,
      })
    },
    [markSungMutation],
  )

  const totalCount = bookmarks.length + notes.length

  // Clear local override when server data catches up
  React.useEffect(() => {
    setLocalOrder(null)
  }, [serverItems])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      // The move is computed on the rows the operator can actually see. With
      // no filter on, filteredItems is the whole list and this is the plain
      // case.
      const oldIndex = filteredItems.findIndex(
        (item) => item.uniqueId === active.id,
      )
      const newIndex = filteredItems.findIndex(
        (item) => item.uniqueId === over.id,
      )

      if (oldIndex === -1 || newIndex === -1) return

      const reorderedVisible = arrayMove(filteredItems, oldIndex, newIndex)
      const visibleIds = new Set(filteredItems.map((item) => item.uniqueId))

      // The reordered rows are poured back into the slots those same rows
      // already occupied, so rows hidden by the filter (notes, and songs on the
      // other side of the sung/pending split) keep their exact position. The
      // endpoint rewrites sort_order from the index of every entry it is given,
      // so it always gets the full list.
      let cursor = 0
      const newOrder = unifiedItems.map((item) =>
        visibleIds.has(item.uniqueId)
          ? (reorderedVisible[cursor++] ?? item)
          : item,
      )

      // Set local order synchronously so the UI doesn't flicker
      setLocalOrder(newOrder)
      reorderItemsMutation.mutate(
        newOrder.map((item) => ({
          type: item.type,
          id: item.type === 'song' ? item.bookmark!.id : item.note!.id,
        })),
      )
    },
    [filteredItems, unifiedItems, reorderItemsMutation],
  )

  const handleRemoveBookmark = useCallback(
    (bookmarkId: number) => {
      removeBookmarkMutation.mutate(bookmarkId)
    },
    [removeBookmarkMutation],
  )

  const handleAddNote = useCallback(() => {
    const trimmed = newNoteContent.trim()
    if (!trimmed) return
    addNoteMutation.mutate(trimmed)
    setNewNoteContent('')
    setIsAddingNote(false)
  }, [newNoteContent, addNoteMutation])

  const handleUpdateNote = useCallback(
    (id: number, content: string) => {
      updateNoteMutation.mutate({ id, content })
    },
    [updateNoteMutation],
  )

  const handleRemoveNote = useCallback(
    (id: number) => {
      removeNoteMutation.mutate(id)
    },
    [removeNoteMutation],
  )

  const {
    ref: songDropRef,
    isOver: isSongOver,
    justLanded: songJustLanded,
  } = useSongDropZone(
    // Duplicates are allowed on purpose — the same song often belongs twice in
    // one service, so every drop adds another row.
    acceptsSongDrop ? (song) => addBookmarkMutation.mutate(song.id) : undefined,
  )

  const handleExport = useCallback(async () => {
    const text = await exportMutation.mutateAsync()
    if (!text) return

    const defaultFilename = `bookmarks-${new Date().toISOString().split('T')[0]}.txt`

    const isTauri =
      typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

    if (isTauri) {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')

      const savePath = await save({
        defaultPath: defaultFilename,
        filters: [{ name: 'Text File', extensions: ['txt'] }],
      })

      if (savePath) {
        await writeTextFile(savePath, text)
      }
    } else {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = defaultFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
  }, [exportMutation])

  const isSearching = searchQuery.trim().length > 0

  const renderItem = (item: BookmarkListItem) => {
    if (item.type === 'note' && item.note) {
      return (
        <SortableNoteItem
          key={item.uniqueId}
          note={item.note}
          onUpdate={(content) => handleUpdateNote(item.note!.id, content)}
          onRemove={() => handleRemoveNote(item.note!.id)}
        />
      )
    }
    if (item.type === 'song' && item.bookmark) {
      return (
        <SortableBookmarkItem
          key={item.uniqueId}
          bookmark={item.bookmark}
          isActive={activeSongId === item.bookmark.songId}
          onSelect={() => onSelectSong(item.bookmark!)}
          onRemove={() => handleRemoveBookmark(item.bookmark!.id)}
          onToggleSung={() => handleToggleSung(item.bookmark!)}
        />
      )
    }
    return null
  }

  return (
    <div
      ref={songDropRef}
      data-testid="bookmarks-drop-zone"
      className={`bg-white dark:bg-gray-800 rounded-lg border flex flex-col overflow-hidden h-full transition-colors ${
        isSongOver
          ? 'border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/40'
          : 'border-gray-200 dark:border-gray-700'
      } ${songJustLanded ? 'song-drop-land' : ''}`}
    >
      {/* Header — when `onToggleCollapse` is wired, the leading chevron lets
          this panel double as its own accordion section so the parent doesn't
          have to wrap it in a CollapsibleSection (which used to stack a
          redundant title bar above this one). Action buttons stay visible
          even when collapsed so the operator can still Add/Export/Clear. */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-expanded={!isCollapsed}
              aria-label={
                isCollapsed
                  ? t('bookmarks.expand', 'Expand')
                  : t('bookmarks.collapse', 'Collapse')
              }
              className="-ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-500 transition-transform hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
              />
            </button>
          ) : null}
          <Bookmark className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
            {t('bookmarks.title')}
          </span>
          {totalCount > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({isSearching ? `${filteredItems.length}/` : ''}
              {totalCount})
            </span>
          )}
        </div>
        {totalCount > 0 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setIsAddingNote(true)
                setTimeout(() => newNoteInputRef.current?.focus(), 0)
              }}
              className="p-1.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors"
              title={t('bookmarks.addNote')}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exportMutation.isPending}
              className="p-1.5 rounded-md bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              title={t('bookmarks.exportAsText')}
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => clearBookmarksMutation.mutate()}
              disabled={clearBookmarksMutation.isPending}
              className="p-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
              title={t('bookmarks.clear')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Body — hidden in the collapsed accordion state. Kept as a fragment
          so the panel's outer flex column still measures correctly. */}
      {isCollapsed ? null : (
        <>
          {/* Add Note Input */}
          {isAddingNote && (
            <div className="px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center gap-1">
                <input
                  ref={newNoteInputRef}
                  type="text"
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddNote()
                    if (e.key === 'Escape') {
                      setIsAddingNote(false)
                      setNewNoteContent('')
                    }
                  }}
                  placeholder={t('bookmarks.notePlaceholder')}
                  className="flex-1 min-w-0 text-xs bg-gray-50 dark:bg-gray-900 border border-blue-300 dark:border-blue-600 rounded px-2 py-1.5 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={!newNoteContent.trim()}
                  className="p-1.5 text-green-600 hover:text-green-700 dark:text-green-400 disabled:opacity-50"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNote(false)
                    setNewNoteContent('')
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XIcon size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Sung/pending/all filter — only when there are song bookmarks. */}
          {bookmarks.length > 0 && (
            <div className="px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div
                className="flex items-center gap-1 rounded-md bg-gray-100 p-0.5 dark:bg-gray-900"
                data-testid="bookmark-sung-filter"
              >
                {(
                  [
                    {
                      key: 'all',
                      label: t('bookmarks.filterAll'),
                      n: bookmarks.length,
                    },
                    {
                      key: 'pending',
                      label: t('bookmarks.filterPending'),
                      n: pendingCount,
                    },
                    {
                      key: 'sung',
                      label: t('bookmarks.filterSung'),
                      n: sungCount,
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSungFilter(opt.key)}
                    aria-pressed={sungFilter === opt.key}
                    data-testid={`bookmark-filter-${opt.key}`}
                    className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                      sungFilter === opt.key
                        ? 'bg-white text-amber-700 shadow-sm dark:bg-gray-700 dark:text-amber-300'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    {opt.label}
                    <span className="ml-1 opacity-60">{opt.n}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          {totalCount > 3 && (
            <div className="px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('bookmarks.searchPlaceholder')}
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
                {searchQuery && (
                  <ClearSearchButton
                    inputRef={searchInputRef}
                    onClear={() => setSearchQuery('')}
                    size={14}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  />
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
            {isLoading ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                ...
              </div>
            ) : totalCount === 0 ? (
              <div className="px-4 py-6 text-center">
                <Bookmark className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('bookmarks.empty')}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {t('bookmarks.emptyDescription')}
                </p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {t('bookmarks.noResults')}
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredItems.map((item) => item.uniqueId)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="p-2 flex flex-col gap-1.5">
                    {filteredItems.map(renderItem)}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </>
      )}
    </div>
  )
}
