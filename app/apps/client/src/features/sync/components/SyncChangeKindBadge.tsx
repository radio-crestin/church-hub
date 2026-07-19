import { useTranslation } from 'react-i18next'

import type { SyncChangeKind } from '../service'

/** Same visual language as SyncUpdateBadge: small rounded chip per kind. */
const KIND_STYLES: Record<SyncChangeKind, string> = {
  added:
    'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  updated: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
  removed: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  conflict:
    'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
}

interface SyncChangeKindBadgeProps {
  changeKind: SyncChangeKind
}

/** Labeled chip for a history row's change kind (added/updated/removed/conflict). */
export function SyncChangeKindBadge({ changeKind }: SyncChangeKindBadgeProps) {
  const { t } = useTranslation('settings')

  return (
    <span
      className={`inline-flex flex-shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-medium ${KIND_STYLES[changeKind]}`}
    >
      {t(`sections.sync.changes.kind.${changeKind}`)}
    </span>
  )
}
