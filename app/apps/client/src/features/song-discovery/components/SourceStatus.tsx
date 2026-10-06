import { CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SourceUpdate } from '../hooks/useSongDiscoverySync'

/** A source's count of new songs, a check mark when none, nothing if unchecked. */
export function SourceStatus({
  update,
  selected,
}: {
  update: SourceUpdate | undefined
  selected: boolean
}) {
  const { t } = useTranslation('songDiscovery')
  if (!update || update.checkedAt === 0) return <span className="w-2" />
  if (update.count === 0) {
    return (
      <CheckCircle2
        aria-label={t('source.upToDate')}
        className={`h-4 w-4 ${selected ? 'text-white/80' : 'text-green-600 dark:text-green-400'}`}
      />
    )
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
        selected
          ? 'bg-white/20 text-white'
          : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
      }`}
    >
      {t('source.newCount', { count: update.count })}
    </span>
  )
}
