import { useTranslation } from 'react-i18next'

import { Button } from '../../../ui/button/Button'
import { usePastBroadcasts } from '../hooks'
import type { PastBroadcast } from '../types'

interface BroadcastTemplateSelectorProps {
  selectedBroadcastId: string | null
  onSelectBroadcast: (broadcast: PastBroadcast | null) => void
  enabled?: boolean
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getPrivacyBadgeClass(status: PastBroadcast['privacyStatus']): string {
  switch (status) {
    case 'public':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    case 'unlisted':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'private':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
  }
}

export function BroadcastTemplateSelector({
  selectedBroadcastId,
  onSelectBroadcast,
  enabled = true,
}: BroadcastTemplateSelectorProps) {
  const { t } = useTranslation('livestream')
  const { broadcasts, isLoading, refetch, isRefetching } =
    usePastBroadcasts(enabled)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('youtube.setup.templateDescription')}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex-shrink-0"
        >
          {isRefetching ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          )}
        </Button>
      </div>

      {/* Past Broadcasts List */}
      {broadcasts.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {broadcasts.map((broadcast) => (
            <button
              key={broadcast.broadcastId}
              type="button"
              onClick={() => onSelectBroadcast(broadcast)}
              className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                selectedBroadcastId === broadcast.broadcastId
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {broadcast.title}
                  </p>
                  {broadcast.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      {broadcast.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {t('youtube.setup.completedAt')}{' '}
                    {formatDate(broadcast.completedAt)}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${getPrivacyBadgeClass(broadcast.privacyStatus)}`}
                >
                  {t(
                    `youtube.privacy${broadcast.privacyStatus.charAt(0).toUpperCase() + broadcast.privacyStatus.slice(1)}`,
                  )}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {broadcasts.length === 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <p className="font-medium">{t('youtube.setup.noTemplates')}</p>
          <p className="text-xs mt-1">{t('youtube.setup.noTemplatesHint')}</p>
        </div>
      )}
    </div>
  )
}
