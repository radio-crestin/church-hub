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
  CalendarPlus,
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
import {
  useAddBookmarkNote,
  useBookmarkNotes,
  useClearBookmarks,
  useExportBookmarksAsText,
  useRemoveBookmark,
  useRemoveBookmarkNote,
  useReorderBookmarkItems,
  useSongBookmarks,
  useUpdateBookmarkNote,
} from '../hooks'
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
}

function SortableBookmarkItem({
  bookmark,
  isActive,
  onSelect,
  onRemove,
}: SortableBookmarkItemProps) {
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
      className={`flex items-center gap-1 rounded-lg border transition-colors ${
        isDragging
          ? 'opacity-80 shadow-lg border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/20'
          : isActive
            ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/20'
            : 'border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-600 bg-white dark:bg-gray-800 hover:bg-amber-50/50 dark:hover:bg-amber-900/10'
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 p-1.5 cursor-grab active:cursor-grabbing rounded-l-lg hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <GripVertical size={14} className="text-gray-400 dark:text-gray-500" />
      </div>

      <button
        type="button"
        onClick={onSelect}
        className="flex-1 min-w-0 text-left py-1.5 pr-1"
      >
        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
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
              <span className="text-xs text-amber-600 dark:text-amber-400 shrink-0">
                {bookmark.songKeyLine}
              </span>
            )}
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
  onAddAllToSchedule?: (songIds: number[]) => void
  activeSongId?: number
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
  onAddAllToSchedule,
  activeSongId,
  isCollapsed = false,
  onToggleCollapse,
}: SongBookmarksPanelProps) {
  const { t } = useTranslation('songs')
  const { data: bookmarks = [], isLoading } = useSongBookmarks()
  const { data: notes = [] } = useBookmarkNotes()
  const clearBookmarksMutation = useClearBookmarks()
  const removeBookmarkMutation = useRemoveBookmark()
  const reorderItemsMutation = useReorderBookmarkItems()
  const addNoteMutation = useAddBookmarkNote()
  const updateNoteMutation = useUpdateBookmarkNote()
  const removeNoteMutation = useRemoveBookmarkNote()
  const exportMutation = useExportBookmarksAsText()
  const [searchQuery, setSearchQuery] = useState('')
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
    if (!searchQuery.trim()) return unifiedItems
    const q = searchQuery.toLowerCase()
    return unifiedItems.filter((item) => {
      if (item.type === 'note') {
        return item.note?.content.toLowerCase().includes(q)
      }
      const b = item.bookmark
      return (
        b?.songTitle.toLowerCase().includes(q) ||
        b?.songCategoryName?.toLowerCase().includes(q) ||
        b?.songKeyLine?.toLowerCase().includes(q)
      )
    })
  }, [unifiedItems, searchQuery])

  const totalCount = bookmarks.length + notes.length

  // Clear local override when server data catches up
  React.useEffect(() => {
    setLocalOrder(null)
  }, [serverItems])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = unifiedItems.findIndex(
        (item) => item.uniqueId === active.id,
      )
      const newIndex = unifiedItems.findIndex(
        (item) => item.uniqueId === over.id,
      )

      if (oldIndex === -1 || newIndex === -1) return

      const newOrder = arrayMove(unifiedItems, oldIndex, newIndex)
      // Set local order synchronously so the UI doesn't flicker
      setLocalOrder(newOrder)
      reorderItemsMutation.mutate(
        newOrder.map((item) => ({
          type: item.type,
          id: item.type === 'song' ? item.bookmark!.songId : item.note!.id,
        })),
      )
    },
    [unifiedItems, reorderItemsMutation],
  )

  const handleRemoveBookmark = useCallback(
    (songId: number) => {
      removeBookmarkMutation.mutate(songId)
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

  const handleAddAllToSchedule = useCallback(() => {
    if (bookmarks.length > 0 && onAddAllToSchedule) {
      onAddAllToSchedule(bookmarks.map((b) => b.songId))
    }
  }, [bookmarks, onAddAllToSchedule])

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
          onRemove={() => handleRemoveBookmark(item.bookmark!.songId)}
        />
      )
    }
    return null
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden h-full">
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
            {onAddAllToSchedule && (
              <button
                type="button"
                onClick={handleAddAllToSchedule}
                className="p-1.5 rounded-md bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 transition-colors"
                title={t('actions.addToSchedule')}
              >
                <CalendarPlus className="w-3.5 h-3.5" />
              </button>
            )}
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
            ) : isSearching ? (
              <div className="p-2 flex flex-col gap-1.5">
                {filteredItems.map(renderItem)}
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={unifiedItems.map((item) => item.uniqueId)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="p-2 flex flex-col gap-1.5">
                    {unifiedItems.map(renderItem)}
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
