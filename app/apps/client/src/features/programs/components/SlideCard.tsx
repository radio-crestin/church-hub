import { useSortable } from '@dnd-kit/sortable'
import { Edit, GripVertical, Trash2 } from 'lucide-react'

import type { Slide } from '../types'

interface SlideCardProps {
  slide: Slide
  index: number
  onEdit: (slide: Slide) => void
  onDelete: (slide: Slide) => void
}

export function SlideCard({ slide, index, onEdit, onDelete }: SlideCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id })

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
  }

  // Extract text preview from HTML content
  const getTextPreview = (html: string | undefined): string => {
    if (!html) return ''
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    const text = tempDiv.textContent || tempDiv.innerText || ''
    return text.slice(0, 100) + (text.length > 100 ? '...' : '')
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <GripVertical size={20} />
      </button>

      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded font-medium text-sm">
        {index + 1}
      </div>

      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => onEdit(slide)}
      >
        <p className="text-sm text-gray-900 dark:text-white truncate">
          {getTextPreview(slide.content.html) || (
            <span className="italic text-gray-400">(Empty slide)</span>
          )}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {slide.content.type}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onEdit(slide)}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
        >
          <Edit size={16} />
        </button>
        <button
          onClick={() => onDelete(slide)}
          className="p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}
