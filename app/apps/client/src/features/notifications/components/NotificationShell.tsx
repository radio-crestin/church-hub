import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { formatRelativeTime } from '~/features/sync/utils/formatRelativeTime'

export type NotificationTone = 'neutral' | 'attention'

/** A plain line icon: grey, or amber when it needs attention. */
const TONES: Record<NotificationTone, string> = {
  neutral: 'text-fg-label',
  attention: 'text-amber-600 dark:text-amber-400',
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
      className={`group flex gap-3 rounded-xl border border-line p-4 transition-colors ${
        isNew ? 'bg-selected' : 'bg-panel'
      }`}
    >
      <div
        className={`flex h-5 w-4 shrink-0 items-center justify-center ${TONES[tone]}`}
      >
        <Icon
          size={16}
          strokeWidth={1.5}
          className={isBusy ? 'animate-spin' : undefined}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-fg">
              {isNew && (
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                />
              )}
              <span className="min-w-0">{title}</span>
            </h3>
            {description && (
              <p className="mt-0.5 text-[13px] text-fg-body">{description}</p>
            )}
          </div>
          {createdAt !== undefined && (
            <time
              dateTime={new Date(createdAt).toISOString()}
              title={new Date(createdAt).toLocaleString(i18n.language)}
              className="shrink-0 pt-0.5 text-xs text-fg-hint tabular-nums"
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
              className="-mt-1 -mr-1 shrink-0 rounded-lg p-1 text-fg-label transition-colors hover:bg-hover hover:text-fg md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          )}
        </div>
        {children && <div className="mt-3">{children}</div>}
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </article>
  )
}
