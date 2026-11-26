import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ScheduleItem, SlideTemplate } from '../types'

interface ScheduleItemVerseteTineriProps {
  item: ScheduleItem
  onRemove: () => void
  onEditSlide: () => void
  onInsertSongAfter: () => void
  onInsertSlideAfter?: (template: SlideTemplate) => void
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function ScheduleItemVerseteTineri({
  item,
  onRemove,
  onEditSlide,
  onInsertSongAfter,
  dragHandleProps,
}: ScheduleItemVerseteTineriProps) {
  const { t } = useTranslation('queue')
  const [showMenu, setShowMenu] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  return (
    <div className="rounded-lg border border-line bg-panel">
      {/* Header */}
      <div className="flex items-center gap-2 p-3">
        {/* Drag Handle */}
        <div
          {...dragHandleProps}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-hover"
        >
          <GripVertical size={16} className="text-fg-hint" strokeWidth={1.5} />
        </div>

        {/* Expand/Collapse */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-shrink-0 p-1 rounded hover:bg-hover"
          title={isExpanded ? t('actions.collapse') : t('actions.expand')}
        >
          {isExpanded ? (
            <ChevronDown size={16} className="text-fg-hint" strokeWidth={1.5} />
          ) : (
            <ChevronRight
              size={16}
              className="text-fg-hint"
              strokeWidth={1.5}
            />
          )}
        </button>

        {/* Icon & Title - Clickable to edit */}
        <button
          type="button"
          onClick={onEditSlide}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
            <Users size={16} className="text-fg-label" strokeWidth={1.5} />
          </div>

          {/* Title & Info */}
          <div className="flex-1 min-w-0">
            {item.verseteTineriEntries.length > 0 ? (
              <div className="space-y-0.5">
                {item.verseteTineriEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="font-medium truncate text-fg">
                      {entry.personName}
                    </span>
                    <span className="text-xs text-fg-hint shrink-0">
                      {entry.reference}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="font-medium text-sm text-fg-hint">
                {t('verseteTineri.entriesCount', { count: 0 })}
              </span>
            )}
          </div>
        </button>

        {/* Context Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded hover:bg-hover"
          >
            <MoreVertical
              size={16}
              className="text-fg-hint"
              strokeWidth={1.5}
            />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-panel border border-line rounded-lg shadow-lg py-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    onEditSlide()
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-fg-body hover:bg-hover"
                >
                  <Pencil size={14} strokeWidth={1.75} />
                  {t('actions.editSlide')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    onInsertSongAfter()
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-fg-body hover:bg-hover"
                >
                  <Plus size={14} strokeWidth={1.75} />
                  {t('actions.insertAfter')}
                </button>
                <hr className="my-1 border-line" />
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    onRemove()
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                  {t('actions.remove')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Expanded Entries */}
      {isExpanded && item.verseteTineriEntries.length > 0 && (
        <div className="px-3 pb-3 space-y-1.5">
          {item.verseteTineriEntries.map((entry) => (
            <div key={entry.id} className="p-2 rounded bg-field text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-fg">{entry.personName}</span>
                <span className="text-xs text-fg-hint">{entry.reference}</span>
              </div>
              <div className="text-fg-label line-clamp-2 text-xs">
                {entry.text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
