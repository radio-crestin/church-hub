import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  /** Buttons on the right: primary, secondary, then an ActionMenu. */
  actions?: ReactNode
}

/**
 * The page's title row: the title (and a line under it) left, actions right.
 * The title and the actions share the first 40px line, so every page title
 * sits at the same height whether or not a description follows it.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-start justify-between gap-2">
      <div className="min-h-10 min-w-0 flex-1 basis-48 pt-2">
        <h1 className="truncate text-lg font-semibold text-fg">{title}</h1>
        {description && <p className="text-sm text-fg-hint">{description}</p>}
      </div>
      {actions && (
        <div className="flex min-h-10 shrink-0 items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  )
}
