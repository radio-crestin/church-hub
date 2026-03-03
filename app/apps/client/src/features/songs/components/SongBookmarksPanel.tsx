import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Bookmark,
  CalendarPlus,
  GripVertical,
  Search,
  Trash2,
  X as XIcon,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  useClearBookmarks,
  useRemoveBookmark,
  useReorderBookmarks,
  useSongBookmarks,
} from '../hooks'
import type { SongBookmark } from '../service'

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
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: bookmark.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1 rounded-lg border transition-all ${
        isActive
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

interface SongBookmarksPanelProps {
  onSelectSong: (bookmark: SongBookmark) => void
  onAddAllToSchedule?: (songIds: number[]) => void
  activeSongId?: number
}

export function SongBookmarksPanel({
  onSelectSong,
  onAddAllToSchedule,
  activeSongId,
}: SongBookmarksPanelProps) {
  const { t } = useTranslation('songs')
  const { data: bookmarks = [], isLoading } = useSongBookmarks()
  const clearBookmarksMutation = useClearBookmarks()
  const removeBookmarkMutation = useRemoveBookmark()
  const reorderBookmarksMutation = useReorderBookmarks()
  const [searchQuery, setSearchQuery] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const filteredBookmarks = useMemo(() => {
    if (!searchQuery.trim()) return bookmarks
    const q = searchQuery.toLowerCase()
    return bookmarks.filter(
      (b) =>
        b.songTitle.toLowerCase().includes(q) ||
        b.songCategoryName?.toLowerCase().includes(q) ||
        b.songKeyLine?.toLowerCase().includes(q),
    )
  }, [bookmarks, searchQuery])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = bookmarks.findIndex((b) => b.id === active.id)
      const newIndex = bookmarks.findIndex((b) => b.id === over.id)

      if (oldIndex === -1 || newIndex === -1) return

      const newOrder = [...bookmarks]
      const [removed] = newOrder.splice(oldIndex, 1)
      newOrder.splice(newIndex, 0, removed)

      reorderBookmarksMutation.mutate(newOrder.map((b) => b.songId))
    },
    [bookmarks, reorderBookmarksMutation],
  )

  const handleRemoveBookmark = useCallback(
    (songId: number) => {
      removeBookmarkMutation.mutate(songId)
    },
    [removeBookmarkMutation],
  )

  const handleAddAllToSchedule = useCallback(() => {
    if (bookmarks.length > 0 && onAddAllToSchedule) {
      onAddAllToSchedule(bookmarks.map((b) => b.songId))
    }
  }, [bookmarks, onAddAllToSchedule])

  const isSearching = searchQuery.trim().length > 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('bookmarks.title')}
          </span>
          {bookmarks.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({isSearching ? `${filteredBookmarks.length}/` : ''}
              {bookmarks.length})
            </span>
          )}
        </div>
        {bookmarks.length > 0 && (
          <div className="flex items-center gap-1">
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

      {/* Search */}
      {bookmarks.length > 3 && (
        <div className="px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('bookmarks.searchPlaceholder')}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
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
        ) : bookmarks.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <Bookmark className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('bookmarks.empty')}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {t('bookmarks.emptyDescription')}
            </p>
          </div>
        ) : filteredBookmarks.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('bookmarks.noResults')}
          </div>
        ) : isSearching ? (
          /* When searching, disable drag-and-drop */
          <div className="p-2 flex flex-col gap-1.5">
            {filteredBookmarks.map((bookmark) => (
              <SortableBookmarkItem
                key={bookmark.id}
                bookmark={bookmark}
                isActive={activeSongId === bookmark.songId}
                onSelect={() => onSelectSong(bookmark)}
                onRemove={() => handleRemoveBookmark(bookmark.songId)}
              />
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredBookmarks.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="p-2 flex flex-col gap-1.5">
                {filteredBookmarks.map((bookmark) => (
                  <SortableBookmarkItem
                    key={bookmark.id}
                    bookmark={bookmark}
                    isActive={activeSongId === bookmark.songId}
                    onSelect={() => onSelectSong(bookmark)}
                    onRemove={() => handleRemoveBookmark(bookmark.songId)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}
