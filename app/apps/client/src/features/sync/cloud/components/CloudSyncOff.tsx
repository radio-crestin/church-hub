import { Cloud, Loader2, LogIn, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { OwnerChurchList } from './OwnerChurchList'
import { useCloudAction } from '../hooks'
import { connectAsGuest, type OwnerSignInIntent } from '../service'

interface CloudSyncOffProps {
  signIn: (intent: OwnerSignInIntent) => void
  waitingFor: OwnerSignInIntent | null
  /** The owner signed in to recover: their churches are listed. */
  ownerEmail: string | null
}

/**
 * "Turn on cloud sync": with Google (that account owns the church and can
 * recover it on another PC) or as a guest (sign in later to claim it); or
 * recover a church already set up on another PC.
 */
export function CloudSyncOff({
  signIn,
  waitingFor,
  ownerEmail,
}: CloudSyncOffProps) {
  const { t } = useTranslation('settings')
  const guest = useCloudAction(connectAsGuest)
  const busy = waitingFor !== null || guest.isPending

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line p-4">
        <div className="flex items-start gap-3">
          <Cloud
            strokeWidth={1.5}
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-fg-label"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-[13px] font-medium text-fg">
              {t('sections.cloudSync.off.title')}
            </h4>
            <p className="mt-0.5 text-xs text-fg-hint">
              {t('sections.cloudSync.off.description')}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => signIn('connect')}
                data-testid="cloud-continue-google"
              >
                {waitingFor === 'connect' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogIn strokeWidth={1.5} className="h-4 w-4" />
                )}
                {t('sections.cloudSync.off.google')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => guest.mutate(undefined)}
                data-testid="cloud-continue-guest"
              >
                <UserRound strokeWidth={1.5} className="h-4 w-4" />
                {t('sections.cloudSync.off.guest')}
              </Button>
            </div>
            <p className="mt-2 text-xs text-fg-hint">
              {t('sections.cloudSync.off.ownerHint')}
            </p>
            {guest.error && (
              <p className="mt-1 text-xs text-live">
                {t('sections.cloudSync.off.failed')}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line p-4">
        <h4 className="text-[13px] font-medium text-fg">
          {t('sections.cloudSync.recover.title')}
        </h4>
        <p className="mt-0.5 mb-3 text-xs text-fg-hint">
          {t('sections.cloudSync.recover.description')}
        </p>
        {ownerEmail ? (
          <>
            <p className="mb-2 text-xs text-fg-label">
              {t('sections.cloudSync.owner.signedInAs', { email: ownerEmail })}
            </p>
            <OwnerChurchList currentChurchId={null} />
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => signIn('manage')}
            data-testid="cloud-recover-google"
          >
            {waitingFor === 'manage' && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {t('sections.cloudSync.recover.signIn')}
          </Button>
        )}
      </div>
    </div>
  )
}
