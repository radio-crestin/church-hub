import { Cloud, Loader2, LogIn } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { CloudBackupErrorText } from './CloudBackupErrorText'
import { TOUCH_HEIGHT } from './touchTarget'
import { useCloudBackupSignIn } from '../hooks'

/** Before signing in: what signing in does, the sign-in, and its wait. */
export function CloudBackupSignedOut() {
  const { t } = useTranslation('settings')
  const { signIn, cancel, waiting, problem } = useCloudBackupSignIn()

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-start gap-3">
        <Cloud
          strokeWidth={1.5}
          className="mt-0.5 h-5 w-5 shrink-0 text-fg-label"
        />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-fg">
            {t('sections.backup.cloud.signedOut.title')}
          </h4>
          <p className="mt-0.5 text-xs text-fg-hint">
            {t('sections.backup.cloud.signedOut.description')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              className={TOUCH_HEIGHT}
              disabled={waiting}
              onClick={signIn}
              data-testid="cloud-backup-sign-in"
            >
              {waiting ? (
                <Loader2 strokeWidth={1.5} className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn strokeWidth={1.5} className="h-4 w-4" />
              )}
              {t('sections.backup.cloud.signedOut.signIn')}
            </Button>
            {waiting && (
              <Button
                size="sm"
                variant="secondary"
                className={TOUCH_HEIGHT}
                onClick={cancel}
                data-testid="cloud-backup-sign-in-cancel"
              >
                {t('sections.backup.cloud.signedOut.cancel')}
              </Button>
            )}
          </div>
          {waiting && (
            <p className="mt-2 text-xs text-fg-hint">
              {t('sections.backup.cloud.signedOut.waiting')}
            </p>
          )}
          {problem && (
            <div className="mt-2">
              <CloudBackupErrorText>
                {t(`sections.backup.cloud.signedOut.${problem}`)}
              </CloudBackupErrorText>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
