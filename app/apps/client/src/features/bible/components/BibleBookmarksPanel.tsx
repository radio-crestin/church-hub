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
  Upload,
  X as XIcon,
} from 'lucide-react'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { applyStylesToText } from '~/features/presentation/utils/applyStylesToText'
import { useScrollToBottomOnAdd } from '~/hooks/useScrollToBottomOnAdd'
import { type OverflowAction, OverflowActions } from '~/ui/menu'
import { ClearSearchButton } from '~/ui/search'
import { normalizeForSearch } from '~/utils/normalizeForSearch'
import { saveTextFile } from '~/utils/saveTextFile'
import { ImportBibleBookmarksModal } from './ImportBibleBookmarksModal'
import { useBookmarkSlideshowActions } from './useBookmarkSlideshowActions'
import {
  useAddBibleBookmarkNote,
  useBibleBookmarkNotes,
  useBibleBookmarks,
  useClearBibleBookmarks,
  useExportBibleBookmarksAsMarkdown,
  useRemoveBibleBookmark,
  useRemoveBibleBookmarkNote,
  useReorderBibleBookmarkItems,
  useUpdateBibleBookmarkNote,
} from '../hooks'
import type { BibleBookmark, BibleBookmarkNote } from '../service'

/** One row of the list verses and notes share. */
interface BookmarkListItem {
  uniqueId: string
  type: 'verse' | 'note'
  sortOrder: number
  bookmark?: BibleBookmark
  note?: BibleBookmarkNote
}

interface SortableBookmarkItemProps {
  bookmark: BibleBookmark
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
  const { t } = useTranslation('bible')
  const uniqueId = `verse-${bookmark.id}`
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
      data-testid="bible-bookmark-item"
      className={`flex items-start gap-1 rounded-lg transition-colors ${
        isDragging
          ? 'bg-panel opacity-90 ring-1 ring-inset ring-line-strong'
          : isActive
            ? 'bg-selected'
            : 'hover:bg-hover'
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        data-testid="bible-bookmark-drag-handle"
        className="flex-shrink-0 p-1.5 cursor-grab active:cursor-grabbing rounded-l-lg hover:bg-hover"
      >
        <GripVertical size={14} className="text-fg-hint" strokeWidth={1.75} />
      </div>

      <button
        type="button"
        onClick={onSelect}
        className="flex-1 min-w-0 text-left py-1.5 pr-1"
      >
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-sm font-medium truncate text-fg"
            data-testid="bible-bookmark-reference"
          >
            {bookmark.reference}
          </span>
          {bookmark.translationAbbreviation && (
            <span className="text-xs text-fg-hint shrink-0">
              {bookmark.translationAbbreviation}
            </span>
          )}
        </div>
        {/* The highlighting saved with the verse is shown here, so the row is
            proof the marking survived. `applyStylesToText` escapes the verse
            text and emits only its own mark/strong/em/u tags - the same
            renderer the screen itself uses. */}
        {bookmark.styleRanges.length > 0 ? (
          <p
            data-testid="bible-bookmark-styled-text"
            className="mt-0.5 text-xs text-fg-hint line-clamp-2 [&_mark]:rounded-sm [&_mark]:px-0.5 [&_mark]:text-gray-900"
            dangerouslySetInnerHTML={{
              __html: applyStylesToText(bookmark.text, bookmark.styleRanges),
            }}
          />
        ) : (
          <p className="mt-0.5 text-xs text-fg-hint line-clamp-2">
            {bookmark.text}
          </p>
        )}
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="flex-shrink-0 p-1.5 text-fg-hint hover:text-red-500 dark:hover:text-red-400 rounded-r-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        title={t('bookmarks.remove')}
      >
        <XIcon size={14} strokeWidth={1.75} />
      </button>
    </div>
  )
}

interface SortableNoteItemProps {
  note: BibleBookmarkNote
  onUpdate: (content: string) => void
  onRemove: () => void
}

function SortableNoteItem({ note, onUpdate, onRemove }: SortableNoteItemProps) {
  const { t } = useTranslation('bible')
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
      data-testid="bible-bookmark-note"
      className={`flex items-center gap-1 rounded-lg bg-field transition-colors ${
        isDragging ? 'opacity-90 ring-1 ring-inset ring-line-strong' : ''
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        data-testid="bible-bookmark-note-drag-handle"
        className="flex-shrink-0 p-1.5 cursor-grab active:cursor-grabbing rounded-l-lg hover:bg-hover"
      >
        <GripVertical size={14} className="text-fg-hint" strokeWidth={1.75} />
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
            className="flex-1 min-w-0 h-7 text-xs bg-panel rounded-md px-2 text-fg focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
          />
          <button
            type="button"
            onClick={handleSave}
            className="p-1 text-fg-label hover:text-fg"
          >
            <Check size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="p-1 text-fg-hint hover:text-fg-label"
          >
            <XIcon size={14} strokeWidth={1.75} />
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 min-w-0 py-1.5 pr-1 flex items-center gap-1.5">
            <StickyNote
              size={12}
              className="flex-shrink-0 text-fg-label"
              strokeWidth={2}
            />
            <span className="text-xs text-fg-body italic truncate">
              {note.content}
            </span>
          </div>

          <button
            type="button"
            onClick={handleStartEdit}
            className="flex-shrink-0 p-1 text-fg-hint hover:text-fg transition-colors"
            title={t('bookmarks.editNote')}
          >
            <Pencil size={12} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="flex-shrink-0 p-1.5 text-fg-hint hover:text-red-500 dark:hover:text-red-400 rounded-r-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title={t('bookmarks.deleteNote')}
          >
            <XIcon size={14} strokeWidth={1.75} />
          </button>
        </>
      )}
    </div>
  )
}

interface BibleBookmarksPanelProps {
  onSelectVerse: (bookmark: BibleBookmark) => void
  /** Verse currently on screen, highlighted in the list. */
  activeVerseId?: number
  /** Translation used for imported references that do not name one. */
  translationId?: number
  /**
   * When provided, renders a chevron toggle inline with the title so the panel
   * can act as its own accordion section. The body is hidden when collapsed;
   * the header keeps its actions so the operator still gets at
   * the slideshow and its "More" menu.
   */
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export function BibleBookmarksPanel({
  onSelectVerse,
  activeVerseId,
  translationId,
  isCollapsed = false,
  onToggleCollapse,
}: BibleBookmarksPanelProps) {
  const { t } = useTranslation('bible')
  const { data: bookmarks = [], isLoading } = useBibleBookmarks()
  const { data: notes = [] } = useBibleBookmarkNotes()
  const clearBookmarksMutation = useClearBibleBookmarks()
  const removeBookmarkMutation = useRemoveBibleBookmark()
  const reorderItemsMutation = useReorderBibleBookmarkItems()
  const addNoteMutation = useAddBibleBookmarkNote()
  const updateNoteMutation = useUpdateBibleBookmarkNote()
  const removeNoteMutation = useRemoveBibleBookmarkNote()
  const exportMutation = useExportBibleBookmarksAsMarkdown()
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')
  const newNoteInputRef = useRef<HTMLInputElement>(null)
  const [isImportOpen, setIsImportOpen] = useState(false)
  // Local order override for instant (synchronous) drag feedback
  const [localOrder, setLocalOrder] = useState<BookmarkListItem[] | null>(null)
  const slideshowActions = useBookmarkSlideshowActions(bookmarks)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const serverItems = useMemo<BookmarkListItem[]>(() => {
    const items: BookmarkListItem[] = [
      ...bookmarks.map((bookmark) => ({
        uniqueId: `verse-${bookmark.id}`,
        type: 'verse' as const,
        sortOrder: bookmark.sortOrder,
        bookmark,
      })),
      ...notes.map((note) => ({
        uniqueId: `note-${note.id}`,
        type: 'note' as const,
        sortOrder: note.sortOrder,
        note,
      })),
    ]
    return items.sort((a, b) => a.sortOrder - b.sortOrder)
  }, [bookmarks, notes])

  // Use local order if set (during drag), otherwise use server data
  const unifiedItems = localOrder ?? serverItems

  // A row just added lands at the end of the list, so bring it into view.
  const listRef = useRef<HTMLDivElement>(null)
  const serverIds = useMemo(
    () => serverItems.map((item) => item.uniqueId),
    [serverItems],
  )
  useScrollToBottomOnAdd(serverIds, listRef, !isLoading && !isCollapsed)

  const filteredItems = useMemo(() => {
    // Folded on both sides so "geneza" finds "Geneză" and vice versa.
    const query = normalizeForSearch(searchQuery.trim())
    if (!query) return unifiedItems

    return unifiedItems.filter((item) => {
      if (item.type === 'note') {
        return normalizeForSearch(item.note?.content ?? '').includes(query)
      }
      const bookmark = item.bookmark
      return (
        normalizeForSearch(bookmark?.reference ?? '').includes(query) ||
        normalizeForSearch(bookmark?.text ?? '').includes(query) ||
        normalizeForSearch(bookmark?.translationAbbreviation ?? '').includes(
          query,
        )
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

      // The move is computed on the rows the operator can actually see. With
      // no search on, filteredItems is the whole list and this is the plain
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
      // already occupied, so rows hidden by the search keep their exact
      // position. The endpoint rewrites sort_order from the index of every
      // entry it is given, so it always gets the full list.
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
          id: item.type === 'verse' ? item.bookmark!.id : item.note!.id,
        })),
      )
    },
    [filteredItems, unifiedItems, reorderItemsMutation],
  )

  const handleAddNote = useCallback(() => {
    const trimmed = newNoteContent.trim()
    if (!trimmed) return
    addNoteMutation.mutate(trimmed)
    setNewNoteContent('')
    setIsAddingNote(false)
  }, [newNoteContent, addNoteMutation])

  const handleExport = useCallback(async () => {
    const text = await exportMutation.mutateAsync()
    if (!text) return

    await saveTextFile({
      content: text,
      defaultFilename: `bible-bookmarks-${new Date().toISOString().split('T')[0]}.md`,
      filterName: 'Markdown',
      extensions: ['md'],
    })
  }, [exportMutation])

  const isSearching = searchQuery.trim().length > 0

  const renderItem = (item: BookmarkListItem) => {
    if (item.type === 'note' && item.note) {
      return (
        <SortableNoteItem
          key={item.uniqueId}
          note={item.note}
          onUpdate={(content) =>
            updateNoteMutation.mutate({ id: item.note!.id, content })
          }
          onRemove={() => removeNoteMutation.mutate(item.note!.id)}
        />
      )
    }
    if (item.type === 'verse' && item.bookmark) {
      return (
        <SortableBookmarkItem
          key={item.uniqueId}
          bookmark={item.bookmark}
          isActive={activeVerseId === item.bookmark.verseId}
          onSelect={() => onSelectVerse(item.bookmark!)}
          onRemove={() => removeBookmarkMutation.mutate(item.bookmark!.id)}
        />
      )
    }
    return null
  }

  const startAddingNote = () => {
    setIsAddingNote(true)
    setTimeout(() => newNoteInputRef.current?.focus(), 0)
  }
  const exportLabel =
    totalCount === 0
      ? t('bookmarks.exportEmpty')
      : t('bookmarks.exportAsMarkdown')

  // The header keeps the slideshow controls in the row; what is used less
  // (headings, import, export, clear) waits under "More". Import is not gated
  // on `totalCount > 0`, because an empty list is exactly when someone wants
  // to paste one in.
  const headerActions: OverflowAction[] = [
    ...slideshowActions,
    ...(totalCount > 0
      ? [
          {
            id: 'add-note',
            label: t('bookmarks.addNote'),
            icon: <Plus size={18} />,
            onSelect: startAddingNote,
            testId: 'bible-bookmarks-add-note-menu',
            menuOnly: true as const,
          },
        ]
      : []),
    {
      id: 'import',
      label: t('bookmarks.importFromText'),
      icon: <Upload size={18} />,
      onSelect: () => setIsImportOpen(true),
      testId: 'bible-bookmarks-import-menu',
      menuOnly: true,
    },
    // Export stays whatever the list holds, so it never appears to come and
    // go; it is disabled rather than hidden when there is nothing to write.
    {
      id: 'export',
      label: exportLabel,
      icon: <Download size={18} />,
      disabled: totalCount === 0 || exportMutation.isPending,
      onSelect: handleExport,
      testId: 'bible-bookmarks-export-menu',
      menuOnly: true,
    },
    ...(totalCount > 0
      ? [
          {
            id: 'clear',
            label: t('bookmarks.clear'),
            icon: <Trash2 size={18} />,
            disabled: clearBookmarksMutation.isPending,
            onSelect: () => clearBookmarksMutation.mutate(),
            testId: 'bible-bookmarks-clear-menu',
            menuOnly: true as const,
          },
        ]
      : []),
  ]

  return (
    <div
      data-testid="bible-bookmarks-panel"
      className="bg-panel rounded-xl border border-line flex flex-col overflow-hidden h-full"
    >
      {/* Header — action buttons stay reachable even when collapsed so the
          operator can still start a slideshow or reach "More"; in a narrow
          column the ones that do not fit move into "More" too. */}
      <div className="flex items-center px-3 py-1.5 border-b border-line flex-shrink-0">
        <OverflowActions
          testId="bible-bookmarks-header-more"
          actions={headerActions}
          leading={
            <>
              {onToggleCollapse ? (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  aria-expanded={!isCollapsed}
                  aria-label={
                    isCollapsed
                      ? t('bookmarks.expand')
                      : t('bookmarks.collapse')
                  }
                  className="-ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-fg-hint transition-transform hover:bg-hover"
                >
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                    strokeWidth={1.75}
                  />
                </button>
              ) : null}
              <Bookmark
                className="w-4 h-4 shrink-0 text-fg-label"
                strokeWidth={1.5}
              />
              {/* One truncating line, so a narrow column cuts the count
                  before it cuts into the title. */}
              <span className="min-w-0 truncate text-sm font-medium text-fg">
                {t('bookmarks.title')}
                {totalCount > 0 && (
                  <span className="ml-2 text-xs font-normal text-fg-hint tabular-nums">
                    ({isSearching ? `${filteredItems.length}/` : ''}
                    {totalCount})
                  </span>
                )}
              </span>
            </>
          }
        />
      </div>

      {/* Body — hidden in the collapsed accordion state. Kept as a fragment so
          the panel's outer flex column still measures correctly. */}
      {isCollapsed ? null : (
        <>
          {isAddingNote && (
            <div className="px-3 py-1.5 border-b border-line flex-shrink-0">
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
                  className="flex-1 min-w-0 h-8 text-sm bg-field rounded-[10px] px-2.5 text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
                />
                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={!newNoteContent.trim()}
                  className="p-1.5 text-fg-label hover:text-fg disabled:opacity-50"
                >
                  <Check size={14} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNote(false)
                    setNewNoteContent('')
                  }}
                  className="p-1.5 text-fg-hint hover:text-fg-label"
                >
                  <XIcon size={14} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          )}

          {totalCount > 3 && (
            <div className="px-3 py-1.5 border-b border-line flex-shrink-0">
              <div className="relative">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-hint"
                  strokeWidth={1.75}
                />
                <input
                  ref={searchInputRef}
                  data-slide-navigation=""
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('bookmarks.searchPlaceholder')}
                  className="w-full h-8 pl-8 pr-7 text-sm bg-field rounded-[10px] text-fg placeholder:text-fg-hint focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus"
                />
                {searchQuery && (
                  <ClearSearchButton
                    inputRef={searchInputRef}
                    onClear={() => setSearchQuery('')}
                    size={14}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-hint hover:text-fg-label"
                  />
                )}
              </div>
            </div>
          )}

          <div
            ref={listRef}
            data-testid="bible-bookmarks-list"
            className="flex-1 overflow-y-auto scrollbar-thin min-h-0"
          >
            {isLoading ? (
              <div className="px-4 py-6 text-center text-sm text-fg-hint">
                ...
              </div>
            ) : totalCount === 0 ? (
              <div className="px-4 py-6 text-center">
                <Bookmark
                  className="w-8 h-8 mx-auto mb-2 text-fg-hint"
                  strokeWidth={1}
                />
                <p className="text-sm text-fg-hint">{t('bookmarks.empty')}</p>
                <p className="text-xs text-fg-hint mt-1">
                  {t('bookmarks.emptyDescription')}
                </p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-fg-hint">
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
                  <div className="p-1.5 flex flex-col gap-0.5">
                    {filteredItems.map(renderItem)}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </>
      )}

      <ImportBibleBookmarksModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        translationId={translationId}
      />
    </div>
  )
}
