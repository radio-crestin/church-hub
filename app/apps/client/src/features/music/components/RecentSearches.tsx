import { useTranslation } from 'react-i18next'

interface RecentSearchesProps {
  searches: string[]
  onPick: (search: string) => void
}

/** The last searches, one tap to run again. */
export function RecentSearches({ searches, onPick }: RecentSearchesProps) {
  const { t } = useTranslation('music')
  if (searches.length === 0) return null

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
      data-testid="music-recent-searches"
    >
      <span>{t('tracks.recentSearches')}</span>
      {searches.map((search) => (
        <button
          key={search}
          type="button"
          onClick={() => onPick(search)}
          className="rounded-md bg-gray-100 px-2 py-0.5 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          {search}
        </button>
      ))}
    </div>
  )
}
