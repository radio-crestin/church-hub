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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  GripVertical,
  Music,
  Plus,
  Save,
  Search,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  useAddScheduleItem,
  useDeleteSchedule,
  useRemoveScheduleItem,
  useReorderScheduleItems,
  useSchedule,
  useUpdateSchedule,
} from '~/features/schedules/hooks/use-schedules'
import type { ScheduleItemResolved } from '~/features/schedules/service/types'
import { useSongs } from '~/features/songs/hooks/use-songs'
import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'

export const Route = createFileRoute('/presentation/$scheduleId')({
  component: ScheduleEditorPage,
})

interface SortableItemProps {
  item: ScheduleItemResolved
  index: number
  onRemove: (id: number) => void
  getItemIcon: (type: string) => ReactNode
  getItemTypeLabel: (type: string) => string
}

function SortableItem({
  item,
  index,
  onRemove,
  getItemIcon,
  getItemTypeLabel,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 group ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      <button
        type="button"
        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="text-sm text-gray-400 dark:text-gray-500 w-6">
        {index + 1}
      </span>
      <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded">
        {getItemIcon(item.item_type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white truncate">
          {item.title}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {getItemTypeLabel(item.item_type)}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

function ScheduleEditorPage() {
  const { t } = useTranslation(['schedules', 'common'])
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { scheduleId } = Route.useParams()
  const numericId = parseInt(scheduleId, 10)

  const { data: schedule, isLoading } = useSchedule(numericId)
  const updateMutation = useUpdateSchedule()
  const deleteMutation = useDeleteSchedule()
  const addItemMutation = useAddScheduleItem()
  const removeItemMutation = useRemoveScheduleItem()
  const reorderMutation = useReorderScheduleItems()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<ScheduleItemResolved[]>([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [showSongPicker, setShowSongPicker] = useState(false)
  const [showTextEditor, setShowTextEditor] = useState(false)
  const [songSearchQuery, setSongSearchQuery] = useState('')
  const [textTitle, setTextTitle] = useState('')
  const [textContent, setTextContent] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  const { data: songs = [], isLoading: songsLoading } = useSongs(
    songSearchQuery || undefined,
  )

  useEffect(() => {
    if (schedule) {
      setTitle(schedule.title)
      setDescription(schedule.description || '')
      setItems(schedule.items)
    }
  }, [schedule])

  useEffect(() => {
    if (schedule) {
      const titleChanged = title !== schedule.title
      const descChanged = description !== (schedule.description || '')
      setHasChanges(titleChanged || descChanged)
    }
  }, [title, description, schedule])

  const handleSave = async () => {
    if (!title.trim()) return

    const result = await updateMutation.mutateAsync({
      id: numericId,
      input: {
        title: title.trim(),
        description: description.trim() || undefined,
      },
    })

    if (result.success) {
      showToast(t('schedules:messages.updated'), 'success')
      setHasChanges(false)
    } else {
      showToast(t('schedules:messages.error'), 'error')
    }
  }

  const handleDelete = async () => {
    const result = await deleteMutation.mutateAsync(numericId)
    if (result.success) {
      showToast(t('schedules:messages.deleted'), 'success')
      navigate({ to: '/presentation' })
    } else {
      showToast(t('schedules:messages.error'), 'error')
    }
    setShowDeleteModal(false)
  }

  const handleRemoveItem = async (itemId: number) => {
    const result = await removeItemMutation.mutateAsync({
      scheduleId: numericId,
      itemId,
    })

    if (result.success) {
      setItems(items.filter((item) => item.id !== itemId))
      showToast(t('schedules:messages.itemRemoved'), 'success')
    } else {
      showToast(t('schedules:messages.error'), 'error')
    }
  }

  const handleAddSong = async (songId: number) => {
    const result = await addItemMutation.mutateAsync({
      scheduleId: numericId,
      input: {
        item_type: 'song',
        content_id: songId,
      },
    })

    if (result.success) {
      showToast(t('schedules:messages.itemAdded'), 'success')
      setShowSongPicker(false)
      setSongSearchQuery('')
    } else {
      showToast(t('schedules:messages.error'), 'error')
    }
  }

  const handleAddText = async () => {
    if (!textTitle.trim() || !textContent.trim()) return

    const result = await addItemMutation.mutateAsync({
      scheduleId: numericId,
      input: {
        item_type: 'text',
        content_data: JSON.stringify({
          title: textTitle.trim(),
          content: textContent.trim(),
        }),
      },
    })

    if (result.success) {
      showToast(t('schedules:messages.itemAdded'), 'success')
      setShowTextEditor(false)
      setTextTitle('')
      setTextContent('')
    } else {
      showToast(t('schedules:messages.error'), 'error')
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)

      const newItems = arrayMove(items, oldIndex, newIndex)
      setItems(newItems)

      const result = await reorderMutation.mutateAsync({
        scheduleId: numericId,
        input: {
          items: newItems.map((item, index) => ({
            id: item.id,
            position: index,
          })),
        },
      })

      if (!result.success) {
        setItems(items)
        showToast(t('schedules:messages.error'), 'error')
      }
    }
  }

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'song':
        return <Music className="w-4 h-4" />
      case 'text':
      case 'section':
        return <Type className="w-4 h-4" />
      default:
        return <Type className="w-4 h-4" />
    }
  }

  const getItemTypeLabel = (type: string) => {
    switch (type) {
      case 'song':
        return t('schedules:items.song')
      case 'bible':
        return t('schedules:items.bible')
      case 'text':
        return t('schedules:items.text')
      case 'section':
        return t('schedules:items.section')
      default:
        return type
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="flex-1 p-4">
          <div className="space-y-4">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (!schedule) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">
          {t('schedules:messages.notFound')}
        </p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate({ to: '/presentation' })}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('schedules:editor.title')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title={t('schedules:actions.delete')}
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || !title.trim() || updateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {t('common:buttons.save')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          {/* Title & Description */}
          <div className="space-y-4">
            <div>
              <label
                htmlFor="schedule-title"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t('schedules:fields.title')}
              </label>
              <input
                id="schedule-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label
                htmlFor="schedule-description"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t('schedules:fields.description')}
              </label>
              <textarea
                id="schedule-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              />
            </div>
          </div>

          {/* Items Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('schedules:editor.items')}
              </h2>
              <button
                type="button"
                onClick={() => setShowAddItemModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('schedules:editor.addItem')}
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {t('schedules:editor.noItems')}
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(true)}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  {t('schedules:editor.addFirstItem')}
                </button>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={items.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <SortableItem
                        key={item.id}
                        item={item}
                        index={index}
                        onRemove={handleRemoveItem}
                        getItemIcon={getItemIcon}
                        getItemTypeLabel={getItemTypeLabel}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title={t('schedules:modal.deleteTitle')}
        message={t('schedules:modal.deleteMessage')}
        confirmLabel={t('schedules:actions.delete')}
        cancelLabel={t('common:buttons.cancel')}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        variant="danger"
      />

      {/* Add Item Type Selection Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAddItemModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('schedules:editor.addItem')}
            </h2>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddItemModal(false)
                  setShowSongPicker(true)
                }}
                className="w-full flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Music className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {t('schedules:items.song')}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('schedules:editor.addSongDescription')}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddItemModal(false)
                  setShowTextEditor(true)
                }}
                className="w-full flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Type className="w-5 h-5 text-green-600 dark:text-green-400" />
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {t('schedules:items.text')}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('schedules:editor.addTextDescription')}
                  </p>
                </div>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowAddItemModal(false)}
              className="mt-4 w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {t('common:buttons.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Song Picker Modal */}
      {showSongPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowSongPicker(false)
              setSongSearchQuery('')
            }}
          />
          <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('schedules:editor.selectSong')}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowSongPicker(false)
                  setSongSearchQuery('')
                }}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={songSearchQuery}
                  onChange={(e) => setSongSearchQuery(e.target.value)}
                  placeholder={t('schedules:editor.searchSongs')}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {songsLoading ? (
                <div className="space-y-2 p-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-14 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : songs.length === 0 ? (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                  {songSearchQuery
                    ? t('schedules:editor.noSongsFound')
                    : t('schedules:editor.noSongsAvailable')}
                </div>
              ) : (
                <div className="space-y-1">
                  {songs.map((song) => (
                    <button
                      key={song.id}
                      type="button"
                      onClick={() => handleAddSong(song.id)}
                      disabled={addItemMutation.isPending}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-left transition-colors disabled:opacity-50"
                    >
                      <Music className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {song.title}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Text Editor Modal */}
      {showTextEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setShowTextEditor(false)
              setTextTitle('')
              setTextContent('')
            }}
          />
          <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('schedules:editor.addText')}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowTextEditor(false)
                  setTextTitle('')
                  setTextContent('')
                }}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label
                  htmlFor="text-title"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  {t('schedules:editor.textTitle')}
                </label>
                <input
                  id="text-title"
                  type="text"
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  placeholder={t('schedules:editor.textTitlePlaceholder')}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  autoFocus
                />
              </div>
              <div>
                <label
                  htmlFor="text-content"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  {t('schedules:editor.textContent')}
                </label>
                <textarea
                  id="text-content"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder={t('schedules:editor.textContentPlaceholder')}
                  rows={6}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <button
                type="button"
                onClick={() => {
                  setShowTextEditor(false)
                  setTextTitle('')
                  setTextContent('')
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                {t('common:buttons.cancel')}
              </button>
              <button
                type="button"
                onClick={handleAddText}
                disabled={
                  !textTitle.trim() ||
                  !textContent.trim() ||
                  addItemMutation.isPending
                }
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('schedules:actions.add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
