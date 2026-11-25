import { LogOut, ShieldOff } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import { OwnerChurchList } from './OwnerChurchList'
import { useCloudAction } from '../hooks'
import { revokeAllDevices, signOutOwner, transferChurch } from '../service'

/**
 * What the signed-in owner does from this PC: see their church servers,
 * revoke every device (and rotate the path), transfer the church.
 */
export function CloudOwnerTools({
  email,
  churchId,
}: {
  email: string
  churchId: string
}) {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [transferTo, setTransferTo] = useState('')
  const signOut = useCloudAction(signOutOwner)
  const revokeAll = useCloudAction(revokeAllDevices)
  const transfer = useCloudAction((to: string) => transferChurch(churchId, to))

  const handleRevoke = async () => {
    try {
      await revokeAll.mutateAsync(undefined)
      showToast(t('sections.cloudSync.owner.revokedAll'), 'success')
    } catch {
      showToast(t('sections.cloudSync.owner.actionFailed'), 'error')
    }
    setConfirmRevoke(false)
  }

  const handleTransfer = async () => {
    try {
      const { pendingOwnerEmail } = await transfer.mutateAsync(transferTo)
      showToast(
        t('sections.cloudSync.owner.transferSent', {
          email: pendingOwnerEmail,
        }),
        'success',
      )
      setTransferTo('')
    } catch {
      showToast(t('sections.cloudSync.owner.actionFailed'), 'error')
    }
  }

  return (
    <div className="space-y-4" data-testid="cloud-owner-tools">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-600 dark:text-gray-300">
          {t('sections.cloudSync.owner.signedInAs', { email })}
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => signOut.mutate(undefined)}
          data-testid="cloud-owner-sign-out"
        >
          <LogOut className="mr-1.5 h-3.5 w-3.5" />
          {t('sections.cloudSync.owner.signOut')}
        </Button>
      </div>

      <div>
        <h5 className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">
          {t('sections.cloudSync.owner.yourChurches')}
        </h5>
        <OwnerChurchList currentChurchId={churchId} />
      </div>

      <div>
        <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {t('sections.cloudSync.owner.transferTitle')}
        </h5>
        <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
          {t('sections.cloudSync.owner.transferHint')}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            value={transferTo}
            onChange={(event) => setTransferTo(event.target.value)}
            placeholder={t('sections.cloudSync.owner.transferPlaceholder')}
            data-testid="cloud-transfer-email"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!transferTo.includes('@') || transfer.isPending}
            onClick={handleTransfer}
            data-testid="cloud-transfer"
          >
            {t('sections.cloudSync.owner.transfer')}
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-red-200 p-3 dark:border-red-900">
        <h5 className="text-xs font-medium text-red-700 dark:text-red-400">
          {t('sections.cloudSync.owner.revokeTitle')}
        </h5>
        <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
          {t('sections.cloudSync.owner.revokeHint')}
        </p>
        <Button
          size="sm"
          variant="danger"
          onClick={() => setConfirmRevoke(true)}
          data-testid="cloud-revoke-all"
        >
          <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
          {t('sections.cloudSync.owner.revokeAll')}
        </Button>
      </div>

      <ConfirmModal
        isOpen={confirmRevoke}
        title={t('sections.cloudSync.owner.revokeTitle')}
        message={t('sections.cloudSync.owner.revokeConfirm')}
        confirmLabel={t('sections.cloudSync.owner.revokeAll')}
        variant="danger"
        isLoading={revokeAll.isPending}
        onConfirm={handleRevoke}
        onCancel={() => setConfirmRevoke(false)}
        testId="cloud-revoke-confirm"
      />
    </div>
  )
}
