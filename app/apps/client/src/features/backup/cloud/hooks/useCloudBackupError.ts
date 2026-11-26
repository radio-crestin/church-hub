import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { formatFileSize } from '~/utils/formatFileSize'
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
  'suspended',
])

/** Turns a failed cloud backup call into a sentence the operator can act on. */
export function useCloudBackupError() {
  const { t, i18n } = useTranslation('settings')
  return useCallback(
    (error: unknown) => {
      const code =
        error instanceof CloudBackupRequestError ? error.code : 'unknown'
      const quota = error instanceof CloudBackupRequestError ? error.quota : {}
      if (code === 'quota_exceeded' && quota.quotaBytes !== undefined) {
        const size = (bytes: number) => formatFileSize(bytes, i18n.language)
        const free =
          quota.quotaBytes - (quota.usedBytes ?? 0) - (quota.reservedBytes ?? 0)
        return t('sections.backup.cloud.errors.quota_exceeded_details', {
          needed: size(quota.neededBytes ?? 0),
          free: size(Math.max(0, free)),
          total: size(quota.quotaBytes),
        })
      }
      return t(
        `sections.backup.cloud.errors.${EXPLAINED.has(code) ? code : 'generic'}`,
      )
    },
    [t, i18n.language],
  )
}
