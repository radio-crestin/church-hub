import { Link } from '@tanstack/react-router'
import { ChevronRight, type LucideIcon } from 'lucide-react'

export type StatusTone = 'ok' | 'busy' | 'off' | 'error'

export const STATUS_DOT: Record<StatusTone, string> = {
  ok: 'bg-ok',
  busy: 'bg-fg-label',
  off: 'bg-fg-hint',
  error: 'bg-red-600',
}

export interface SettingsLinkButtonProps {
  to:
    | '/livestream/youtube'
    | '/livestream/obs'
    | '/livestream/mixer'
    | '/settings/livestream'
  icon: LucideIcon
  label: string
  status: string
  tone: StatusTone
  testId: string
}

/** Opens one settings page; shows the state of what it sets up. */
export function SettingsLinkButton({
  to,
  icon: Icon,
  label,
  status,
  tone,
  testId,
}: SettingsLinkButtonProps) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2.5 text-left transition-colors hover:bg-hover focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus"
    >
      <Icon
        size={16}
        strokeWidth={1.5}
        className="shrink-0 text-fg-label"
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-fg">
          {label}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-fg-hint">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[tone]}`}
            aria-hidden
          />
          <span className="truncate">{status}</span>
        </span>
      </span>
      <ChevronRight
        size={16}
        strokeWidth={1.5}
        className="shrink-0 text-fg-hint"
        aria-hidden
      />
    </Link>
  )
}
