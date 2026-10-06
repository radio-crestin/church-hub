import { ChevronRight, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { AppNotification } from './types'

interface NotificationCardProps {
  notification: AppNotification
  /** After the user opened something from it. */
  onActed: () => void
  /** Closes it: from the pop-up, or for good from the bell. */
  onClose?: () => void
}

/** One notification: its title, its lines, its action. */
export function NotificationCard({
  notification,
  onActed,
  onClose,
}: NotificationCardProps) {
  const { t } = useTranslation('sidebar')
  const { icon: Icon, title, description, lines, action } = notification
  const act = (run: () => void) => () => {
    run()
    onActed()
  }

  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="flex-1 text-sm font-semibold text-gray-900 dark:text-white">
            {title}
          </p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('notifications.dismiss')}
              title={t('notifications.dismiss')}
              className="-mt-1 -mr-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
        {lines && lines.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {lines.map((line) => (
              <li key={line.key}>
                <button
                  type="button"
                  disabled={!line.onClick}
                  onClick={line.onClick && act(line.onClick)}
                  className="flex w-full items-center gap-2 rounded-md bg-gray-50 px-2 py-1.5 text-left text-sm text-gray-800 enabled:hover:bg-gray-100 dark:bg-gray-800/60 dark:text-gray-100 dark:enabled:hover:bg-gray-800"
                >
                  <span className="min-w-0 flex-1 truncate">{line.label}</span>
                  <span className="shrink-0 text-xs font-medium text-indigo-600 tabular-nums dark:text-indigo-300">
                    {line.value}
                  </span>
                  {line.onClick && (
                    <ChevronRight size={14} className="shrink-0 opacity-50" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {action && (
          <button
            type="button"
            onClick={act(action.onClick)}
            className="mt-2 w-full rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}
