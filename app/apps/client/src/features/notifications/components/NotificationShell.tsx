import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { formatRelativeTime } from '~/features/sync/utils/formatRelativeTime'

export type NotificationTone = 'indigo' | 'emerald' | 'amber'

const TONES: Record<NotificationTone, string> = {
  indigo:
    'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300',
  emerald:
    'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
}

interface NotificationShellProps {
  icon: LucideIcon
  tone: NotificationTone
  title: string
  description?: string
  /** When it happened; none for something happening now. */
  createdAt?: number
  /** Not read yet: a dot and a tinted card. */
  isNew?: boolean
  /** Happening now: the icon turns. */
  isBusy?: boolean
  /** Removes it (the history) or closes it (the pop-up). */
  onClose?: () => void
  closeLabel?: string
  /** Buttons under it. */
  actions?: ReactNode
  /** What it is about: songs, a version… */
  children?: ReactNode
  testId?: string
}

/** One notification's card: the same look on the page and in the pop-up. */
export function NotificationShell({
  icon: Icon,
  tone,
  title,
  description,
  createdAt,
  isNew = false,
  isBusy = false,
  onClose,
  closeLabel,
  actions,
  children,
  testId,
}: NotificationShellProps) {
  const { i18n } = useTranslation()

  return (
    <article
      data-testid={testId}
      data-new={isNew || undefined}
      className={`group flex gap-3 rounded-xl border p-4 transition-colors ${
        isNew
          ? 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-800/60 dark:bg-indigo-950/30'
          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONES[tone]}`}
      >
        <Icon size={18} className={isBusy ? 'animate-spin' : undefined} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
              {isNew && (
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full bg-indigo-500"
                />
              )}
              <span className="min-w-0">{title}</span>
            </h3>
            {description && (
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
                {description}
              </p>
            )}
          </div>
          {createdAt !== undefined && (
            <time
              dateTime={new Date(createdAt).toISOString()}
              title={new Date(createdAt).toLocaleString(i18n.language)}
              className="shrink-0 pt-0.5 text-xs text-gray-400 dark:text-gray-500"
            >
              {formatRelativeTime(createdAt, i18n.language)}
            </time>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              title={closeLabel}
              className="-mt-1 -mr-1 shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {children && <div className="mt-3">{children}</div>}
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </article>
  )
}
