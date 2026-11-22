import { ChevronDown, ChevronRight } from 'lucide-react'
import { type ReactNode, useState } from 'react'

interface SettingsSectionProps {
  title: string
  icon: React.ComponentType<{ className?: string }>
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
    <div
      data-testid={testId}
      className="border-b border-gray-200 dark:border-gray-800"
    >
      <button
        type="button"
        aria-expanded={isOpen}
        className="flex items-center w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800/50"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
        )}
        <Icon className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
        <span className="text-sm font-medium text-gray-900 dark:text-gray-200">
          {title}
        </span>
      </button>
      {isOpen && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </div>
  )
}
