import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { CloudBackupRequestError } from '../service/cloudBackup'

/** Codes with their own explanation; anything else gets the generic one. */
const EXPLAINED = new Set([
  'cloud_sign_in_required',
  'quota_exceeded',
  'too_large',
  'daily_limit',
  'rate_limited',
  'busy',
  'upload_in_progress',
  'backup_unreadable',
  'not_found',
  'service_unreachable',
  'not_configured',
])

/** Turns a failed cloud backup call into a sentence the operator can act on. */
export function useCloudBackupError() {
  const { t } = useTranslation('settings')
  return useCallback(
    (error: unknown) => {
      const code =
        error instanceof CloudBackupRequestError ? error.code : 'unknown'
      return t(
        `sections.backup.cloud.errors.${EXPLAINED.has(code) ? code : 'generic'}`,
      )
    },
    [t],
  )
}
