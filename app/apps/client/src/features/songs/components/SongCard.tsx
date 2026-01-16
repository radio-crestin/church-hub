import { ChevronRight, Eye, Music2, Sparkles, Tag } from 'lucide-react'
import { forwardRef } from 'react'

interface SongCardProps {
  song: {
    id: number
    title: string
    categoryId: number | null
    categoryName: string | null
    keyLine?: string | null
    highlightedTitle?: string
    matchedContent?: string
    presentationCount?: number
    aiRelevanceScore?: number
  }
  onClick: () => void
  onMiddleClick?: () => void
  isSelected?: boolean
}

export const SongCard = forwardRef<HTMLButtonElement, SongCardProps>(
  function SongCard({ song, onClick, onMiddleClick, isSelected = false }, ref) {
    const hasHighlight = song.highlightedTitle?.includes('<mark>')

    return (
      <button
        ref={ref}
        type="button"
        onClick={(e) => {
          // CMD+click (Mac) or Ctrl+click (Windows/Linux) opens in new window
          if ((e.metaKey || e.ctrlKey) && onMiddleClick) {
            e.preventDefault()
            onMiddleClick()
            return
          }
          onClick()
        }}
        onAuxClick={(e) => {
          if (e.button === 1 && onMiddleClick) {
            e.preventDefault()
            onMiddleClick()
          }
        }}
        className={`w-full min-w-0 flex items-center justify-between p-4 border rounded-lg hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all text-left group overflow-hidden ${
          isSelected
            ? 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/20 dark:ring-indigo-400/20 bg-indigo-50 dark:bg-indigo-900/20'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }`}
      >
        <div className="flex-1 min-w-0">
          {hasHighlight ? (
            <h3
              className="font-medium text-gray-900 dark:text-white truncate [&_mark]:bg-yellow-300 [&_mark]:dark:bg-yellow-400/60 [&_mark]:rounded-sm [&_mark]:px-0.5"
              dangerouslySetInnerHTML={{ __html: song.highlightedTitle! }}
            />
          ) : (
            <h3 className="font-medium text-gray-900 dark:text-white truncate">
              {song.title}
            </h3>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {song.categoryName && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                <Tag className="w-3 h-3" />
                {song.categoryName}
              </span>
            )}
            {song.presentationCount !== undefined &&
              song.presentationCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 rounded">
                  <Eye className="w-3 h-3" />
                  {song.presentationCount}
                </span>
              )}
            {song.aiRelevanceScore !== undefined && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded">
                <Sparkles className="w-3 h-3" />
                {song.aiRelevanceScore}%
              </span>
            )}
            {song.keyLine && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded">
                <Music2 className="w-3 h-3" />
                {song.keyLine}
              </span>
            )}
          </div>
          {song.matchedContent && (
            <p
              className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 [&_mark]:bg-yellow-300 [&_mark]:dark:bg-yellow-400/60 [&_mark]:rounded-sm [&_mark]:px-0.5"
              dangerouslySetInnerHTML={{ __html: song.matchedContent }}
            />
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors flex-shrink-0 ml-2" />
      </button>
    )
  },
)
