import { Crown, Music2, Tag } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Title + badges + author/hymn + category/key chips for one version row.
 * Shared between the grouped member rows and the current-song row shown in
 * the suggestions-only state, so both render identically.
 */
export function VersionRowInfo({
  title,
  hymnNumber,
  author,
  keyLine,
  categoryName,
  isPrimary = false,
  isCurrent = false,
}: {
  title: string
  hymnNumber: string | null
  author: string | null
  keyLine: string | null
  categoryName: string | null
  isPrimary?: boolean
  isCurrent?: boolean
}) {
  const { t } = useTranslation('songs')
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="truncate text-sm font-medium text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
          {title}
        </span>
        {isCurrent ? (
          <span className="inline-flex items-center rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white dark:bg-indigo-500">
            {t('versions.currentBadge')}
          </span>
        ) : null}
        {isPrimary ? (
          <span
            title={t('versions.primary')}
            className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          >
            <Crown size={10} />
            {t('versions.primary')}
          </span>
        ) : null}
      </div>
      {author || hymnNumber ? (
        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
          {[hymnNumber, author].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      {categoryName || keyLine ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          {categoryName ? (
            <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              <Tag className="h-3 w-3" />
              {categoryName}
            </span>
          ) : null}
          {keyLine ? (
            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <Music2 className="h-3 w-3" />
              {keyLine}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
