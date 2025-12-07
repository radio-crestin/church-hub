import { ChevronRight, Tag } from 'lucide-react'

interface SongCardProps {
  song: {
    id: number
    title: string
    categoryId: number | null
    categoryName: string | null
    matchedContent?: string
  }
  onClick: () => void
}

export function SongCard({ song, onClick }: SongCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all text-left group"
    >
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-900 dark:text-white truncate">
          {song.title}
        </h3>
        {song.categoryName && (
          <div className="flex items-center gap-1 mt-1">
            <Tag className="w-3 h-3 text-gray-400" />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {song.categoryName}
            </span>
          </div>
        )}
        {song.matchedContent && (
          <p
            className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1"
            dangerouslySetInnerHTML={{ __html: song.matchedContent }}
          />
        )}
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors flex-shrink-0 ml-2" />
    </button>
  )
}
