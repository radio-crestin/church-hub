import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'

interface SessionNoticeProps {
  /** Key of `publicApp`: its `title` and `body` are shown. */
  notice:
    | 'removed'
    | 'joinFailed.invalid'
    | 'joinFailed.refused'
    | 'joinFailed.offline'
  onRetry?: () => void
}

/** Why there is no church to show, and what to do about it. */
export function SessionNotice({ notice, onRetry }: SessionNoticeProps) {
  const { t } = useTranslation('publicApp')
  return (
    <div
      data-testid="session-notice"
      data-notice={notice}
      className="mx-auto flex max-w-sm flex-col items-center gap-3 py-16 text-center"
    >
      <h2 className="text-base font-semibold text-fg">
        {t(`${notice}.title`)}
      </h2>
      <p className="text-sm text-fg-label">{t(`${notice}.body`)}</p>
      {onRetry && (
        <Button size="lg" onClick={onRetry} className="mt-2">
          {t('retry')}
        </Button>
      )}
    </div>
  )
}
