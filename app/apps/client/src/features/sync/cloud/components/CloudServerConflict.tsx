import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import type { CloudServerConflict as Conflict } from '../../service'
import { formatRelativeTime } from '../../utils/formatRelativeTime'
import { useCloudAction } from '../hooks'
import { keepChurch } from '../service'

/**
 * Another PC turned up with this church's server token (a backup restored
 * there): the user picks which PC keeps the church.
 */
export function CloudServerConflict({ conflict }: { conflict: Conflict }) {
  const { t, i18n } = useTranslation('settings')
  const keep = useCloudAction(keepChurch)
  const name =
    conflict.otherPcName ?? t('sections.cloudSync.conflict.unknownPc')
  const lastSeen = conflict.otherPcLastSeenAt
    ? formatRelativeTime(conflict.otherPcLastSeenAt * 1000, i18n.language)
    : t('sections.cloudSync.conflict.unknownTime')

  return (
    <div
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20"
      data-testid="cloud-conflict"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-amber-900 dark:text-amber-100">
            {t('sections.cloudSync.conflict.title')}
          </h4>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
            {t('sections.cloudSync.conflict.body', { name, lastSeen })}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              size="sm"
              disabled={keep.isPending}
              onClick={() => keep.mutate(true)}
              data-testid="cloud-keep-here"
            >
              {t('sections.cloudSync.conflict.keepHere')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={keep.isPending}
              onClick={() => keep.mutate(false)}
              data-testid="cloud-keep-other"
            >
              {t('sections.cloudSync.conflict.keepOther', { name })}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
