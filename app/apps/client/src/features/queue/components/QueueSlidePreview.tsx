import type { SongSlide } from '~/features/songs/types'

interface QueueSlidePreviewProps {
  slide: SongSlide
  slideIndex: number
  isActive: boolean
  onClick: () => void
}

export function QueueSlidePreview({
  slide,
  slideIndex,
  isActive,
  onClick,
}: QueueSlidePreviewProps) {
  // Strip HTML tags for preview text
  const previewText =
    slide.content.replace(/<[^>]*>/g, '').trim() || 'Empty slide'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-2 pl-10 rounded-lg border transition-all ${
        isActive
          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
      }`}
    >
      <div className="flex items-center gap-2">
        {/* Slide Number */}
        <div
          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
            isActive
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}
        >
          {slideIndex + 1}
        </div>

        {/* Slide Preview */}
        <div
          className={`flex-1 min-w-0 text-sm line-clamp-1 ${
            isActive
              ? 'text-indigo-900 dark:text-indigo-100'
              : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          {previewText}
        </div>
      </div>
    </button>
  )
}
