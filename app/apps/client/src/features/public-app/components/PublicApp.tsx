import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

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
    <div className="min-h-dvh bg-gray-50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] dark:bg-gray-950">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
        <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {t('appName')}
        </h1>
        {session.kind === 'joined' && (
          <button
            type="button"
            onClick={() => setConfirmLeave(true)}
            className="rounded-lg px-2 py-1 text-sm text-gray-600 active:bg-gray-100 dark:text-gray-400 dark:active:bg-gray-800"
          >
            {t('leave.button')}
          </button>
        )}
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 py-4">
        {session.kind === 'loading' && (
          <p className="py-16 text-center text-sm text-gray-600 dark:text-gray-400">
            {t('loading')}
          </p>
        )}
        {session.kind === 'joined' && (
          <ChurchSongs readUrl={session.binding.readUrl} />
        )}
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
