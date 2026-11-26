import { useTranslation } from 'react-i18next'

import type { SyncChangeKind } from '../service'

/** Same visual language as SyncUpdateBadge: plain meta text, amber for a conflict, red for a refusal. */
const KIND_STYLES: Record<SyncChangeKind, string> = {
  added: 'text-fg-label',
  updated: 'text-fg-label',
  removed: 'text-fg-hint',
  conflict: 'text-amber-700 dark:text-amber-400',
  rejected: 'text-red-700 dark:text-red-400',
}

interface SyncChangeKindBadgeProps {
  changeKind: SyncChangeKind
}

/** Labeled chip for a history row's change kind (added/updated/removed/conflict/rejected). */
export function SyncChangeKindBadge({ changeKind }: SyncChangeKindBadgeProps) {
  const { t } = useTranslation('settings')

  return (
    <span
      className={`inline-flex flex-shrink-0 items-center text-xs font-medium ${KIND_STYLES[changeKind]}`}
    >
      {t(`sections.sync.changes.kind.${changeKind}`)}
    </span>
  )
}
