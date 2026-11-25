import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  /** Buttons on the right: primary, secondary, then an ActionMenu. */
  actions?: ReactNode
}

/** The page's title row: the title (and a line under it) left, actions right. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-2">
      <div className="min-w-0 flex-1 basis-48">
        <h1 className="truncate text-base font-semibold text-fg">{title}</h1>
        {description && (
          <p className="text-[13px] text-fg-hint">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </header>
  )
}
