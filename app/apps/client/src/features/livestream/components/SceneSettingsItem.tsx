import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Link } from '@tanstack/react-router'
import { GripVertical, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { KeyboardShortcutBadge } from '~/ui/kbd'
import type { OBSScene } from '../types'

interface SceneSettingsItemProps {
  scene: OBSScene
}

export function SceneSettingsItem({ scene }: SceneSettingsItemProps) {
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
      className={`flex items-center gap-3 rounded-lg border border-line bg-panel p-3 ${
        isDragging ? 'ring-1 ring-focus' : ''
      } ${!scene.isVisible ? 'opacity-60' : ''}`}
    >
      <button
        type="button"
        className="p-1 text-fg-hint hover:text-fg cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} strokeWidth={1.5} />
      </button>

      <div className="flex-1 min-w-0">
        <span className="block truncate text-sm font-medium text-fg">
          {scene.displayName}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {scene.displayName !== scene.obsSceneName && (
            <span className="text-xs text-fg-hint truncate">
              {scene.obsSceneName}
            </span>
          )}
          {hasShortcuts && (
            <div className="flex flex-wrap gap-1">
              {scene.shortcuts.map((shortcut) => (
                <KeyboardShortcutBadge key={shortcut} shortcut={shortcut} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Link
        to="/livestream/scenes/$sceneId"
        params={{ sceneId: String(scene.id) }}
        aria-label={t('scenes.settings')}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-label transition-colors hover:bg-hover hover:text-fg"
        title={t('scenes.settings')}
      >
        <Settings size={16} strokeWidth={1.5} />
      </Link>
    </div>
  )
}
