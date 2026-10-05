import { MessageSquarePlus, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { AnnotationTool } from '../types'

interface AnnotationToolPickerProps {
  tool: AnnotationTool
  onChange: (tool: AnnotationTool) => void
}

const TOOLS = [
  { id: 'pen', icon: Pencil, labelKey: 'common:featureRequest.toolPen' },
  {
    id: 'note',
    icon: MessageSquarePlus,
    labelKey: 'common:featureRequest.toolNote',
  },
] as const

/** Two big buttons: draw on the screenshot, or add a text note to it. */
export function AnnotationToolPicker({
  tool,
  onChange,
}: AnnotationToolPickerProps) {
  const { t } = useTranslation()
  return (
    <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-900 p-1 gap-1">
      {TOOLS.map(({ id, icon: Icon, labelKey }) => (
        <button
          key={id}
          type="button"
          data-testid={`feature-request-tool-${id}`}
          aria-pressed={tool === id}
          onClick={() => onChange(id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${tool === id ? 'bg-indigo-600 text-white shadow' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
          <Icon size={16} />
          {t(labelKey)}
        </button>
      ))}
    </div>
  )
}
