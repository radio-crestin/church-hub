import { CheckCircle2, Loader2, LogIn, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { ConfirmModal } from '~/ui/modal'
import { CloudOwnerTools } from './CloudOwnerTools'
import { CloudServerConflict } from './CloudServerConflict'
import type { CloudSyncInfo, SyncStatus } from '../../service'
import { useCloudAction } from '../hooks'
import { disconnectCloud, type OwnerSignInIntent } from '../service'

interface CloudSyncOnProps {
  cloud: CloudSyncInfo
  ownerSession: SyncStatus['ownerSession']
  signIn: (intent: OwnerSignInIntent) => void
  waitingFor: OwnerSignInIntent | null
}

/**
 * Cloud sync is on: who owns the church (or claim it, as a guest), the
 * owner's tools once signed in, and turning it off.
 */
export function CloudSyncOn({
  cloud,
  ownerSession,
  signIn,
  waitingFor,
}: CloudSyncOnProps) {
  const { t } = useTranslation('settings')
  const [confirmOff, setConfirmOff] = useState(false)
  const disconnect = useCloudAction(disconnectCloud)
  const signedInAsOwner =
    ownerSession !== null && ownerSession.email === cloud.ownerEmail

  return (
    <div className="space-y-4">
      {cloud.serverConflict && (
        <CloudServerConflict conflict={cloud.serverConflict} />
      )}

      <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" />
            <div className="min-w-0">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                {t('sections.cloudSync.on.title')}
              </h4>
              {cloud.ownerEmail ? (
                <p
                  className="mt-0.5 text-xs text-gray-600 dark:text-gray-300"
                  data-testid="cloud-owner-email"
                >
                  {t('sections.cloudSync.on.owner', {
                    email: cloud.ownerEmail,
                  })}
                </p>
              ) : (
                <p
                  className="mt-0.5 flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300"
                  data-testid="cloud-guest"
                >
                  <UserRound className="h-3.5 w-3.5" />
                  {t('sections.cloudSync.on.guest')}
                </p>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmOff(true)}
            data-testid="cloud-disconnect"
          >
            {t('sections.cloudSync.on.turnOff')}
          </Button>
        </div>

        {!cloud.ownerEmail && (
          <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              {t('sections.cloudSync.on.claimHint')}
            </p>
            <Button
              size="sm"
              disabled={waitingFor !== null}
              onClick={() => signIn('claim')}
              data-testid="cloud-claim"
            >
              {waitingFor === 'claim' ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-1.5 h-4 w-4" />
              )}
              {t('sections.cloudSync.on.claim')}
            </Button>
          </div>
        )}

        {cloud.ownerEmail && (
          <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
            {signedInAsOwner ? (
              <CloudOwnerTools
                email={ownerSession.email}
                churchId={cloud.churchId}
              />
            ) : (
              <>
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  {t('sections.cloudSync.on.manageHint')}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={waitingFor !== null}
                  onClick={() => signIn('manage')}
                  data-testid="cloud-manage"
                >
                  {waitingFor === 'manage' && (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  )}
                  {t('sections.cloudSync.on.manage')}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmOff}
        title={t('sections.cloudSync.on.turnOffTitle')}
        message={t('sections.cloudSync.on.turnOffConfirm')}
        confirmLabel={t('sections.cloudSync.on.turnOff')}
        isLoading={disconnect.isPending}
        onConfirm={async () => {
          await disconnect.mutateAsync(undefined).catch(() => undefined)
          setConfirmOff(false)
        }}
        onCancel={() => setConfirmOff(false)}
        testId="cloud-disconnect-confirm"
      />
    </div>
  )
}
