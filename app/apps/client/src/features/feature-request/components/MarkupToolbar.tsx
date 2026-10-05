import {
  Circle,
  Highlighter,
  MoveUpRight,
  Pencil,
  Square,
  Type,
  Undo2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ColorSwatches } from './ColorSwatches'
import type { AnnotationTool } from '../types'

interface MarkupToolbarProps {
  tool: AnnotationTool
  onToolChange: (tool: AnnotationTool) => void
  color: string
  onColorChange: (color: string) => void
  canUndo: boolean
  onUndo: () => void
}

const TOOLS = [
  { id: 'pen', icon: Pencil, labelKey: 'common:featureRequest.toolPen' },
  {
    id: 'highlighter',
    icon: Highlighter,
    labelKey: 'common:featureRequest.toolHighlighter',
  },
  { id: 'rect', icon: Square, labelKey: 'common:featureRequest.toolRect' },
  {
    id: 'ellipse',
    icon: Circle,
    labelKey: 'common:featureRequest.toolEllipse',
  },
  {
    id: 'arrow',
    icon: MoveUpRight,
    labelKey: 'common:featureRequest.toolArrow',
  },
  { id: 'note', icon: Type, labelKey: 'common:featureRequest.toolNote' },
] as const

const iconButton =
  'flex items-center justify-center w-10 h-10 rounded-full transition-colors'

/**
 * The markup palette, styled after iPad Markup: one rounded bar with the
 * tools, the colours and Undo. Every button names itself on hover.
 */
export function MarkupToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  canUndo,
  onUndo,
}: MarkupToolbarProps) {
  const { t } = useTranslation()
  return (
    <div
      data-testid="feature-request-toolbar"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 self-center rounded-2xl sm:rounded-full bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm px-3 py-1.5"
    >
      <div className="flex items-center gap-0.5" role="group">
        {TOOLS.map(({ id, icon: Icon, labelKey }) => (
          <button
            key={id}
            type="button"
            data-testid={`feature-request-tool-${id}`}
            aria-label={t(labelKey)}
            title={t(labelKey)}
            aria-pressed={tool === id}
            onClick={() => onToolChange(id)}
            className={`${iconButton} ${tool === id ? 'bg-indigo-600 text-white shadow' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
          >
            <Icon size={20} />
          </button>
        ))}
      </div>
      <span
        aria-hidden="true"
        className="hidden sm:block w-px h-6 bg-gray-300 dark:bg-gray-600"
      />
      <ColorSwatches color={color} onChange={onColorChange} />
      <span
        aria-hidden="true"
        className="hidden sm:block w-px h-6 bg-gray-300 dark:bg-gray-600"
      />
      <button
        type="button"
        data-testid="feature-request-undo"
        aria-label={t('common:featureRequest.undo')}
        title={t('common:featureRequest.undo')}
        disabled={!canUndo}
        onClick={onUndo}
        className={`${iconButton} text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-35 disabled:hover:bg-transparent`}
      >
        <Undo2 size={20} />
      </button>
    </div>
  )
}
