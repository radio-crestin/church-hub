import { Loader2, Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { formatRelativeTime } from '../../utils/formatRelativeTime'
import { useCloudAction, useOwnerChurches } from '../hooks'
import { acceptChurch, recoverChurch } from '../service'

/**
 * The signed-in owner's church servers: this PC's is marked, another one
 * can be recovered here (when this PC has none), an offered one accepted.
 */
export function OwnerChurchList({
  currentChurchId,
}: {
  currentChurchId: string | null
}) {
  const { t, i18n } = useTranslation('settings')
  const churches = useOwnerChurches(true)
  const recover = useCloudAction(recoverChurch)
  const accept = useCloudAction(acceptChurch)

  if (churches.isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-fg-hint" />
  }
  if (churches.error) {
    return (
      <p className="text-xs text-live">
        {t('sections.cloudSync.owner.listFailed')}
      </p>
    )
  }
  const list = churches.data?.churches ?? []
  if (list.length === 0) {
    return (
      <p className="text-xs text-fg-hint">
        {t('sections.cloudSync.owner.noChurches')}
      </p>
    )
  }

  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {list.map((church) => {
        const isHere = church.churchId === currentChurchId
        return (
          <li
            key={church.churchId}
            className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            data-testid={`owner-church-${church.churchId}`}
          >
            <div className="flex min-w-0 items-start gap-2">
              <Server
                strokeWidth={1.5}
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-fg-label"
              />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-fg">
                  {church.name}
                  {isHere && (
                    <span className="ml-2 rounded-md bg-selected px-1.5 py-0.5 text-xs text-fg-label">
                      {t('sections.cloudSync.owner.thisPc')}
                    </span>
                  )}
                </p>
                <p className="text-xs text-fg-hint">
                  {church.role === 'pending'
                    ? t('sections.cloudSync.owner.offered')
                    : t('sections.cloudSync.owner.churchDetails', {
                        count: church.deviceCount,
                        updated: formatRelativeTime(
                          church.updatedAt * 1000,
                          i18n.language,
                        ),
                      })}
                </p>
              </div>
            </div>
            {church.role === 'pending' ? (
              <Button
                size="sm"
                disabled={accept.isPending}
                onClick={() => accept.mutate(church.churchId)}
                data-testid="owner-church-accept"
              >
                {t('sections.cloudSync.owner.accept')}
              </Button>
            ) : (
              !currentChurchId && (
                <Button
                  size="sm"
                  disabled={recover.isPending}
                  onClick={() => recover.mutate(church.churchId)}
                  data-testid="owner-church-recover"
                >
                  {t('sections.cloudSync.owner.recover')}
                </Button>
              )
            )}
          </li>
        )
      })}
    </ul>
  )
}
