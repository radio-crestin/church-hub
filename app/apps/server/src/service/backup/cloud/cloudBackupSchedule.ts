import { getSetting, upsertSetting } from '../../settings'

const KEY = 'cloud_backup_schedule'

/** Automatic cloud backups, kept in app_settings (nothing secret). */
export interface CloudBackupSchedule {
  autoBackupEnabled: boolean
  intervalHours: number
  /** Unix ms of the last cloud backup made from this PC. */
  lastBackupAt: number | null
}

const DEFAULT_SCHEDULE: CloudBackupSchedule = {
  autoBackupEnabled: false,
  intervalHours: 24,
  lastBackupAt: null,
}

/** The intervals the app offers, in hours. */
export const CLOUD_BACKUP_INTERVALS = [6, 12, 24, 48, 168]

export function getCloudBackupSchedule(): CloudBackupSchedule {
  const value = getSetting('app_settings', KEY)?.value
  return value
    ? {
        ...DEFAULT_SCHEDULE,
        ...(JSON.parse(value) as Partial<CloudBackupSchedule>),
      }
    : { ...DEFAULT_SCHEDULE }
}

export function updateCloudBackupSchedule(
  patch: Partial<CloudBackupSchedule>,
): CloudBackupSchedule {
  const next = { ...getCloudBackupSchedule(), ...patch }
  upsertSetting('app_settings', { key: KEY, value: JSON.stringify(next) })
  return next
}
