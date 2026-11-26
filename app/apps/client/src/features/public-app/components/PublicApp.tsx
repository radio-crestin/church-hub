import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AppMark } from '~/ui/brand/AppMark'
import { Button } from '~/ui/button'
import { ConfirmModal } from '~/ui/modal'
import { ChurchSongs } from './ChurchSongs'
import { SessionNotice } from './SessionNotice'
import { useChurchSession } from '../hooks/useChurchSession'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
})

/**
 * The public web app (T-168): the client built as a PWA for any phone or
 * browser. Opening a join link binds it to that church; from then on it
 * shows the church's songs, read from the cloud, even offline.
 */
export function PublicApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <PublicAppShell />
    </QueryClientProvider>
  )
}

function PublicAppShell() {
  const { t } = useTranslation('publicApp')
  const { session, leave } = useChurchSession()
  const [confirmLeave, setConfirmLeave] = useState(false)

  return (
    <div className="min-h-dvh bg-app pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-10 border-b border-line bg-app pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
          <h1 className="flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-fg">
            <AppMark size={24} />
            {t('appName')}
          </h1>
          {session.kind === 'joined' && (
            <Button
              variant="ghost"
              size="lg"
              className="-mr-3 px-3"
              onClick={() => setConfirmLeave(true)}
            >
              {t('leave.button')}
            </Button>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 py-4">
        {session.kind === 'loading' && (
          <p className="py-16 text-center text-sm text-fg-label">
            {t('loading')}
          </p>
        )}
        {session.kind === 'joined' && <ChurchSongs binding={session.binding} />}
        {session.kind === 'notJoined' && <SessionNotice notice="notJoined" />}
        {session.kind === 'removed' && <SessionNotice notice="removed" />}
        {session.kind === 'joinFailed' && (
          <SessionNotice
            notice={`joinFailed.${session.reason}`}
            onRetry={
              session.reason === 'offline'
                ? () => window.location.reload()
                : undefined
            }
          />
        )}
      </main>
      <ConfirmModal
        isOpen={confirmLeave}
        title={t('leave.title')}
        message={t('leave.message')}
        confirmLabel={t('leave.button')}
        cancelLabel={t('leave.cancel')}
        variant="danger"
        onConfirm={() => {
          setConfirmLeave(false)
          leave()
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </div>
  )
}
