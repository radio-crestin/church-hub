import { useTranslation } from 'react-i18next'

interface SessionNoticeProps {
  /** Key of `publicApp`: its `title` and `body` are shown. */
  notice:
    | 'notJoined'
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
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {t(`${notice}.title`)}
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t(`${notice}.body`)}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white active:bg-indigo-700"
        >
          {t('retry')}
        </button>
      )}
    </div>
  )
}
