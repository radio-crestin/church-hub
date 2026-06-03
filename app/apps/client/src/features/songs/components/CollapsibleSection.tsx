import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

interface CollapsibleSectionProps {
  /** Plain text or i18n string rendered as the section title. */
  title: string
  /** Optional leading icon (defaults to none). */
  icon?: ReactNode
  /**
   * Small chip rendered next to the title — used by Versions to surface
   * the unread-suggestions count (e.g. `+2`) so the operator notices new
   * candidates without expanding the section.
   */
  badge?: string | null
  /**
   * Optional tone for the badge. Defaults to `'indigo'`. Use `'accent'`
   * for "needs attention" (new suggestions) — emerald hue.
   */
  badgeTone?: 'indigo' | 'accent'
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
  /**
   * Forces the body to a fixed height; the accordion otherwise flex-grows
   * to fill remaining column height. Useful when the body has its own
   * internal scroll and shouldn't compete with siblings.
   */
  className?: string
}

/**
 * Two stacked accordion sections in the song detail's right column —
 * Marcaje + Versiuni — replace the previous "Versions sits under Control"
 * arrangement. Each section keeps its panel's existing chrome intact;
 * `CollapsibleSection` only adds the toggle bar and the flex behavior so
 * expanded sections share the column's remaining vertical space.
 *
 * Click anywhere on the bar to toggle. The chevron rotates 180° as a
 * visual confirmation of the state.
 */
export function CollapsibleSection({
  title,
  icon,
  badge,
  badgeTone = 'indigo',
  isOpen,
  onToggle,
  children,
  className,
}: CollapsibleSectionProps) {
  const badgeClasses =
    badgeTone === 'accent'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
      : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'

  return (
    <section
      className={`flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 ${isOpen ? 'min-h-0 flex-1' : 'flex-none'} ${className ?? ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40"
      >
        <ChevronDown
          size={14}
          className={`shrink-0 text-gray-500 transition-transform duration-200 dark:text-gray-400 ${isOpen ? '' : '-rotate-90'}`}
        />
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span className="flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-200">
          {title}
        </span>
        {badge ? (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClasses}`}
          >
            {badge}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      ) : null}
    </section>
  )
}
