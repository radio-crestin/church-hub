import { useTranslation } from 'react-i18next'

import { AppMark } from '~/ui/brand/AppMark'
import { Button } from '~/ui/button'
import { SessionNotice } from './SessionNotice'
import type { WebAppNotice } from '../service/startWebApp'

const BASE = import.meta.env.BASE_URL

/**
 * Why the web app didn't open a church: a join link that failed, or a
 * device the church removed. It goes on as a guest from here (or with the
 * church it was joined to before the link).
 */
export function WebAppNoticePage({ notice }: { notice: WebAppNotice }) {
  const { t } = useTranslation('publicApp')
  const key =
    notice.kind === 'removed'
      ? 'removed'
      : (`joinFailed.${notice.reason}` as const)

  return (
    <div className="min-h-dvh bg-app pb-[env(safe-area-inset-bottom)]">
      <header className="border-b border-line bg-app pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center px-4">
          <h1 className="flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-fg">
            <AppMark size={24} />
            {t('appName')}
          </h1>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-4">
        <SessionNotice
          notice={key}
          onRetry={
            key === 'joinFailed.offline'
              ? () => window.location.reload()
              : undefined
          }
        >
          <Button
            variant="secondary"
            size="lg"
            className="mt-2"
            onClick={() => window.location.replace(BASE)}
          >
            {t('guest.button')}
          </Button>
        </SessionNotice>
      </main>
    </div>
  )
}
