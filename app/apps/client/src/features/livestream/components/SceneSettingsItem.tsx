import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { formatShortcutForDisplay } from '~/features/keyboard-shortcuts'
import type { OBSScene } from '../types'

interface SceneSettingsItemProps {
  scene: OBSScene
  onOpenSettings: () => void
}

export function SceneSettingsItem({
  scene,
  onOpenSettings,
}: SceneSettingsItemProps) {
  const { t } = useTranslation('livestream')

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scene.id! })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const hasShortcuts = scene.shortcuts && scene.shortcuts.length > 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 p-3 bg-white dark:bg-gray-800
        border border-gray-200 dark:border-gray-700 rounded-lg
        ${isDragging ? 'shadow-lg ring-2 ring-indigo-500' : ''}
        ${!scene.isVisible ? 'opacity-60' : ''}
      `}
    >
      <button
        type="button"
        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={20} />
      </button>

      <div className="flex-1 min-w-0">
        <span className="font-medium text-gray-900 dark:text-white truncate block">
          {scene.displayName}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {scene.displayName !== scene.obsSceneName && (
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {scene.obsSceneName}
            </span>
          )}
          {hasShortcuts && (
            <div className="flex flex-wrap gap-1">
              {scene.shortcuts.map((shortcut) => (
                <span
                  key={shortcut}
                  className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                >
                  {formatShortcutForDisplay(shortcut)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
        title={t('scenes.settings')}
      >
        <Settings size={18} />
      </button>
    </div>
  )
}
