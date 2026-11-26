import { ChevronDown, ChevronRight } from 'lucide-react'
import { type ReactNode, useState } from 'react'

interface SettingsSectionProps {
  title: string
  icon: React.ComponentType<{
    className?: string
    size?: number
    strokeWidth?: number
  }>
  children: ReactNode
  defaultOpen?: boolean
  testId?: string
}

/** A collapsible block of the screen editor's sidebar. */
export function SettingsSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  testId,
}: SettingsSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div data-testid={testId} className="border-b border-line">
      <button
        type="button"
        aria-expanded={isOpen}
        className="flex items-center w-full h-10 px-4 text-left hover:bg-hover"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            className="mr-2 text-fg-hint"
          />
        ) : (
          <ChevronRight
            size={14}
            strokeWidth={1.75}
            className="mr-2 text-fg-hint"
          />
        )}
        <Icon size={16} strokeWidth={1.5} className="mr-2 text-fg-label" />
        <span className="text-sm font-medium text-fg">{title}</span>
      </button>
      {isOpen && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </div>
  )
}
