import { useTranslation } from 'react-i18next'

import { Button } from '../../../ui/button/Button'
import { Combobox } from '../../../ui/combobox/Combobox'
import { useUpcomingBroadcasts } from '../hooks'
import type { UpcomingBroadcast } from '../types'

interface BroadcastSelectorProps {
  value?: string
  onChange: (broadcastId: string | null) => void
  disabled?: boolean
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getPrivacyBadgeClass(
  status: UpcomingBroadcast['privacyStatus'],
): string {
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

export function BroadcastSelector({
  value,
  onChange,
  disabled = false,
}: BroadcastSelectorProps) {
  const { t } = useTranslation('livestream')
  const { broadcasts, isLoading, refetch, isRefetching } =
    useUpcomingBroadcasts()

  const selectedBroadcast = broadcasts.find((b) => b.broadcastId === value)

  const options = broadcasts.map((broadcast) => ({
    value: broadcast.broadcastId,
    label: broadcast.title,
  }))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Combobox
          options={options}
          value={value || null}
          onChange={(val) => onChange(val as string | null)}
          placeholder={t('youtube.setup.selectBroadcast')}
          disabled={disabled || isLoading}
          allowClear={true}
          className="flex-1"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          disabled={disabled || isLoading || isRefetching}
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

      {broadcasts.length === 0 && !isLoading && (
        <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <p className="font-medium">{t('youtube.setup.noBroadcasts')}</p>
          <p className="text-xs mt-1">{t('youtube.setup.noBroadcastsHint')}</p>
        </div>
      )}

      {selectedBroadcast && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 dark:text-white truncate">
                {selectedBroadcast.title}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('youtube.setup.scheduledFor')}{' '}
                {formatDate(selectedBroadcast.scheduledStartTime)}
              </p>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPrivacyBadgeClass(selectedBroadcast.privacyStatus)}`}
            >
              {t(
                `youtube.privacy${selectedBroadcast.privacyStatus.charAt(0).toUpperCase() + selectedBroadcast.privacyStatus.slice(1)}`,
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
