import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SyncChangeKind } from '../service'

interface SyncUpdateBadgeProps {
  changeKind: SyncChangeKind
}

/**
 * Small list-row label for entities changed on another device. `conflict`
 * (a local unsynced edit was overwritten by a newer remote version) gets a
 * warning colour; every other kind reads as a plain "Updated" hint.
 */
export function SyncUpdateBadge({ changeKind }: SyncUpdateBadgeProps) {
  const { t } = useTranslation('common')
  const isConflict = changeKind === 'conflict'

  return (
    <span
      title={t(isConflict ? 'sync.conflictTooltip' : 'sync.updatedTooltip')}
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        isConflict ? 'text-amber-700 dark:text-amber-400' : 'text-fg-hint'
      }`}
    >
      {isConflict ? (
        <AlertTriangle strokeWidth={2} className="w-3 h-3" />
      ) : (
        <RefreshCw strokeWidth={2} className="w-3 h-3" />
      )}
      {t(isConflict ? 'sync.conflictBadge' : 'sync.updatedBadge')}
    </span>
  )
}
