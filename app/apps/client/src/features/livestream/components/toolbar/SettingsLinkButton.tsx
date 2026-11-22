import { Link } from '@tanstack/react-router'
import { ChevronRight, type LucideIcon } from 'lucide-react'

export type StatusTone = 'ok' | 'busy' | 'off' | 'error'

const DOT: Record<StatusTone, string> = {
  ok: 'bg-green-500',
  busy: 'bg-yellow-500 animate-pulse',
  off: 'bg-gray-400 dark:bg-gray-500',
  error: 'bg-red-500',
}

interface SettingsLinkButtonProps {
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
      className="flex min-w-0 items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/20"
    >
      <Icon
        className="h-5 w-5 shrink-0 text-gray-600 dark:text-gray-300"
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
          {label}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${DOT[tone]}`}
            aria-hidden
          />
          <span className="truncate">{status}</span>
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
    </Link>
  )
}
