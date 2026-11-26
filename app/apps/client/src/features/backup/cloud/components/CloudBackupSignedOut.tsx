import { Cloud, Loader2, LogIn } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { useCloudBackupSignIn } from '../hooks'

/** "Church Hub Cloud (free)" before signing in: what it is, and the sign-in. */
export function CloudBackupSignedOut() {
  const { t } = useTranslation('settings')
  const { signIn, waiting, failed } = useCloudBackupSignIn()

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-start gap-3">
        <Cloud
          strokeWidth={1.5}
          className="mt-0.5 h-5 w-5 shrink-0 text-fg-label"
        />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-fg">
            {t('sections.backup.cloud.title')}
          </h4>
          <p className="mt-0.5 text-xs text-fg-hint">
            {t('sections.backup.cloud.signedOut.description')}
          </p>
          <Button
            size="sm"
            className="mt-3"
            disabled={waiting}
            onClick={signIn}
            data-testid="cloud-backup-sign-in"
          >
            {waiting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn strokeWidth={1.5} className="h-4 w-4" />
            )}
            {t('sections.backup.cloud.signedOut.signIn')}
          </Button>
          {waiting && (
            <p className="mt-2 text-xs text-fg-hint">
              {t('sections.backup.cloud.signedOut.waiting')}
            </p>
          )}
          {failed && (
            <p className="mt-2 text-xs text-live" role="alert">
              {t('sections.backup.cloud.signedOut.failed')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
