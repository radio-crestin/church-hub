import { Loader2, LogIn } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { FeaturedSourcesEditor } from './FeaturedSourcesEditor'
import { SubmissionCard } from './SubmissionCard'
import { useCuratorSignIn } from '../hooks/useCuratorSignIn'
import { useLibrarySubmissions } from '../hooks/useLibrarySubmissions'

/**
 * The Church Hub Library's curator page: sign in with Google, then review
 * the songs churches sent in (approve, merge into a song, reject).
 */
export function CuratorPanel() {
  const { t } = useTranslation('songLibrary')
  const { status, signIn, waiting, error } = useCuratorSignIn()
  const curator = status.data?.curator ?? false
  const submissions = useLibrarySubmissions(curator)

  if (status.isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-fg-hint" />
  }
  if (status.isError) {
    return <p className="text-sm text-fg-hint">{t('curator.unavailable')}</p>
  }

  if (!status.data?.signedIn || !curator) {
    return (
      <div className="space-y-2" data-testid="library-curator-sign-in">
        {status.data?.signedIn && (
          <p className="text-sm text-fg" data-testid="library-not-curator">
            {t('curator.notCurator', { email: status.data.email })}
          </p>
        )}
        <Button
          size="sm"
          disabled={waiting}
          onClick={signIn}
          data-testid="library-curator-google"
        >
          {waiting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn strokeWidth={1.5} className="h-4 w-4" />
          )}
          {t('curator.signIn')}
        </Button>
        {waiting && (
          <p className="text-xs text-fg-hint">{t('curator.waiting')}</p>
        )}
        {error && (
          <p className="text-xs text-fg">{t('curator.signInFailed')}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3" data-testid="library-curator">
      <p className="text-xs text-fg-hint">
        {t('curator.signedInAs', { email: status.data.email })}
      </p>
      {submissions.isLoading && (
        <Loader2 className="h-4 w-4 animate-spin text-fg-hint" />
      )}
      {submissions.isError && (
        <p className="text-sm text-fg-hint">{t('curator.unavailable')}</p>
      )}
      {submissions.data?.length === 0 && (
        <p className="text-sm text-fg-hint" data-testid="library-queue-empty">
          {t('curator.empty')}
        </p>
      )}
      {submissions.data?.map((submission) => (
        <SubmissionCard key={submission.id} submission={submission} />
      ))}
      <div className="border-t border-line pt-4">
        <FeaturedSourcesEditor />
      </div>
    </div>
  )
}
