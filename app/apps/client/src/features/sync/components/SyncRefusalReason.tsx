import { useTranslation } from 'react-i18next'

/** Refusals that no permission key names. */
const SPECIAL = new Set(['super_admin', 'active_user'])

interface SyncRefusalReasonProps {
  /** The permission the sync service said the change needed. */
  permission: string
}

/** "Needs: Edit songs": why the sync service refused a change made here. */
export function SyncRefusalReason({ permission }: SyncRefusalReasonProps) {
  const { t } = useTranslation('settings')
  const label = SPECIAL.has(permission)
    ? t(`sections.sync.changes.needsSpecial.${permission}`)
    : t(`sections.users.permissionLabels.${permission}`, {
        defaultValue: permission,
      })
  return <>{t('sections.sync.changes.needs', { permission: label })}</>
}
