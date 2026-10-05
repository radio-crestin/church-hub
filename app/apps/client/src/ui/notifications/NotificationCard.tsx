import {
  AlertTriangle,
  CheckCircle2,
  Info,
  type LucideIcon,
  X,
  XCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { Notification, NotificationKind } from './types'

interface KindStyle {
  icon: LucideIcon
  accent: string
  iconColor: string
}

const KIND_STYLES: Record<NotificationKind, KindStyle> = {
  info: {
    icon: Info,
    accent: 'border-l-indigo-500',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
  },
  success: {
    icon: CheckCircle2,
    accent: 'border-l-green-500',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  warning: {
    icon: AlertTriangle,
    accent: 'border-l-amber-500',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  error: {
    icon: XCircle,
    accent: 'border-l-red-500',
    iconColor: 'text-red-600 dark:text-red-400',
  },
}

interface NotificationCardProps {
  notification: Notification
  onDismiss: (id: string) => void
}

/** One notification: icon, optional title, message, action and close. */
export function NotificationCard({
  notification,
  onDismiss,
}: NotificationCardProps) {
  const { t } = useTranslation('common')
  const { id, kind, title, message, action, dismissible = true } = notification
  const { icon: Icon, accent, iconColor } = KIND_STYLES[kind]
  const isUrgent = kind === 'error' || kind === 'warning'

  return (
    <div
      data-testid="notification"
      data-kind={kind}
      role={isUrgent ? 'alert' : 'status'}
      className={`pointer-events-auto flex shrink-0 items-start gap-3 rounded-xl border-l-4 bg-white px-4 py-3 text-gray-900 shadow-xl ring-1 ring-black/10 animate-notification-in dark:bg-gray-800 dark:ring-white/15 dark:text-white ${accent}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} aria-hidden />
      <div className="min-w-0 flex-1 text-sm leading-5">
        {title && <p className="font-semibold">{title}</p>}
        <p className="break-words text-gray-700 dark:text-gray-200">
          {message}
        </p>
        {action && (
          <button
            type="button"
            onClick={() => {
              action.onClick()
              onDismiss(id)
            }}
            className="mt-2 rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
          >
            {action.label}
          </button>
        )}
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={() => onDismiss(id)}
          aria-label={t('notifications.dismiss')}
          className="-m-1 shrink-0 rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
