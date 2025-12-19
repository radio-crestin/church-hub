import { Pencil } from 'lucide-react'

// Slide type for announcement/custom slides
interface Slide {
  type?: string
  sortOrder: number
  content?: {
    html?: string
  }
}

interface SlidePreviewProps {
  slide: Slide
  isActive: boolean
  onClick: () => void
  onEdit?: () => void
}

export function SlidePreview({
  slide,
  isActive,
  onClick,
  onEdit,
}: SlidePreviewProps) {
  const content = slide.content?.html || ''

  // Strip HTML tags for preview text
  const previewText = content.replace(/<[^>]*>/g, '').trim() || 'Empty slide'

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit?.()
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border-2 transition-all group ${
        isActive
          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Slide Number */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            isActive
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}
        >
          {slide.sortOrder + 1}
        </div>

        {/* Slide Preview */}
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm line-clamp-2 ${
              isActive
                ? 'text-indigo-900 dark:text-indigo-100'
                : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            {previewText}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 capitalize">
            {slide.type}
          </div>
        </div>

        {/* Edit Button */}
        {onEdit && (
          <button
            type="button"
            onClick={handleEditClick}
            className="flex-shrink-0 p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
            title="Edit slide"
          >
            <Pencil size={16} className="text-gray-500 dark:text-gray-400" />
          </button>
        )}
      </div>
    </button>
  )
}
