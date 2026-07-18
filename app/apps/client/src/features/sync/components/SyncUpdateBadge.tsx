import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SyncChangeKind } from '../service'

interface SyncUpdateBadgeProps {
  changeKind: SyncChangeKind
}

/**
 * Small list-row chip for entities changed on another device. `conflict`
 * (a local unsynced edit was overwritten by a newer remote version) gets a
 * warning style; every other kind reads as a plain "Updated" hint.
 */
export function SyncUpdateBadge({ changeKind }: SyncUpdateBadgeProps) {
  const { t } = useTranslation('common')
  const isConflict = changeKind === 'conflict'

  return (
    <span
      title={t(isConflict ? 'sync.conflictTooltip' : 'sync.updatedTooltip')}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded ${
        isConflict
          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
          : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
      }`}
    >
      {isConflict ? (
        <AlertTriangle className="w-3 h-3" />
      ) : (
        <RefreshCw className="w-3 h-3" />
      )}
      {t(isConflict ? 'sync.conflictBadge' : 'sync.updatedBadge')}
    </span>
  )
}
