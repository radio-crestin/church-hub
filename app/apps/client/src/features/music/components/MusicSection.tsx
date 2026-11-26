import { type ReactNode, useId } from 'react'

interface MusicSectionProps {
  title: string
  /** Shown beside the title; `countLabel` is what a screen reader hears. */
  count?: number
  countLabel?: string
  /** Buttons or controls at the right of the title. */
  actions?: ReactNode
  children: ReactNode
  /** A main section (16px title) or a group inside one (13px, like the sidebar). */
  variant?: 'section' | 'group'
  className?: string
  headerClassName?: string
  testId?: string
}

/** One part of a music panel: its title row, then what it holds. */
export function MusicSection({
  title,
  count,
  countLabel,
  actions,
  children,
  variant = 'section',
  className = '',
  headerClassName = '',
  testId,
}: MusicSectionProps) {
  const titleId = useId()

  return (
    <section
      aria-labelledby={titleId}
      data-testid={testId}
      className={`flex min-w-0 flex-col gap-2 p-2.5 ${className}`}
    >
      <div
        className={`flex min-h-8 items-center gap-2 pl-0.5 ${headerClassName}`}
      >
        <h2
          id={titleId}
          className={`min-w-0 truncate text-fg ${
            variant === 'section'
              ? 'text-base font-semibold'
              : 'text-[13px] font-medium'
          }`}
          data-testid={testId && `${testId}-title`}
        >
          {title}
        </h2>
        {count !== undefined && (
          <span className="text-xs tabular-nums text-fg-hint">
            <span aria-hidden="true">{count}</span>
            <span className="sr-only">{countLabel}</span>
          </span>
        )}
        {actions && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {actions}
          </div>
        )}
      </div>
      {children}
    </section>
  )
}
