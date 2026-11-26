import { useTranslation } from 'react-i18next'

import { SwitchRow } from '~/ui/switch/SwitchRow'
import { useToast } from '~/ui/toast'
import { useCloudBackupAction, useCloudBackupError } from '../hooks'
import {
  type CloudBackupStatus,
  updateCloudBackupSchedule,
} from '../service/cloudBackup'

const INTERVALS = [6, 12, 24, 48, 168]

/** Automatic cloud backups: the switch and how often. */
export function CloudBackupSchedule({ status }: { status: CloudBackupStatus }) {
  const { t } = useTranslation('settings')
  /** Compact pill label: 6 → "6h", 24 → "1d", 168 → "7d" (translated units). */
  const intervalLabel = (hours: number) =>
    hours % 24 === 0
      ? t('sections.backup.cloud.auto.short.days', { count: hours / 24 })
      : t('sections.backup.cloud.auto.short.hours', { count: hours })
  const { showToast } = useToast()
  const explain = useCloudBackupError()
  const update = useCloudBackupAction(updateCloudBackupSchedule)
  const save = (patch: Parameters<typeof updateCloudBackupSchedule>[0]) =>
    update.mutate(patch, {
      onError: (error) => showToast(explain(error), 'error'),
    })

  return (
    <div className="rounded-xl border border-line p-4">
      <SwitchRow
        label={t('sections.backup.cloud.auto.title')}
        description={t('sections.backup.cloud.auto.description')}
        checked={status.autoBackupEnabled}
        onCheckedChange={(autoBackupEnabled) => save({ autoBackupEnabled })}
        disabled={update.isPending}
        testId="cloud-backup-auto"
      />
      {status.autoBackupEnabled && (
        <div className="mt-2">
          <p className="mb-1.5 text-xs font-medium text-fg-label">
            {t('sections.backup.cloud.auto.interval')}
          </p>
          <div className="inline-flex flex-wrap gap-1 rounded-lg bg-field p-1">
            {INTERVALS.map((hours) => {
              const selected = status.intervalHours === hours
              return (
                <button
                  key={hours}
                  type="button"
                  onClick={() => save({ intervalHours: hours })}
                  disabled={update.isPending}
                  aria-pressed={selected}
                  title={t('sections.backup.cloud.auto.everyHours', { hours })}
                  className={`min-w-[3rem] rounded-md px-3 py-1.5 text-sm font-medium tabular-nums max-md:py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50 ${
                    selected
                      ? 'bg-selected text-fg'
                      : 'text-fg-label hover:bg-hover hover:text-fg'
                  }`}
                >
                  {intervalLabel(hours)}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
