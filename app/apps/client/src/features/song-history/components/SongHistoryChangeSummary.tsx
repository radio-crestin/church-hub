import { useTranslation } from 'react-i18next'

import type { SongHistoryEntrySummary } from '../types'

interface SongHistoryChangeSummaryProps {
  entry: SongHistoryEntrySummary
}

/** One line saying what an entry changed, e.g. "Title changed · 2 slides changed". */
export function SongHistoryChangeSummary({
  entry,
}: SongHistoryChangeSummaryProps) {
  const { t } = useTranslation('songHistory')
  const { changes } = entry

  if (entry.kind === 'created') {
    return <>{t('summary.created', { count: entry.changes.slidesAdded })}</>
  }

  const parts = [
    changes.titleChanged && t('summary.titleChanged'),
    changes.slidesChanged > 0 &&
      t('summary.slidesChanged', { count: changes.slidesChanged }),
    changes.slidesAdded > 0 &&
      t('summary.slidesAdded', { count: changes.slidesAdded }),
    changes.slidesRemoved > 0 &&
      t('summary.slidesRemoved', { count: changes.slidesRemoved }),
  ].filter(Boolean)

  return <>{parts.join(' · ')}</>
}
