import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, Eye, EyeOff, GripVertical, Pencil, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { OBSScene } from '../types'

interface SceneSettingsItemProps {
  scene: OBSScene
  onToggleVisibility: () => void
  onUpdateDisplayName: (displayName: string) => void
}

export function SceneSettingsItem({
  scene,
  onToggleVisibility,
  onUpdateDisplayName,
}: SceneSettingsItemProps) {
  const { t } = useTranslation('livestream')
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(scene.displayName)

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

  const handleEdit = useCallback(() => {
    setEditValue(scene.displayName)
    setIsEditing(true)
  }, [scene.displayName])

  const handleSave = useCallback(() => {
    if (editValue.trim() && editValue !== scene.displayName) {
      onUpdateDisplayName(editValue.trim())
    }
    setIsEditing(false)
  }, [editValue, scene.displayName, onUpdateDisplayName])

  const handleCancel = useCallback(() => {
    setEditValue(scene.displayName)
    setIsEditing(false)
  }, [scene.displayName])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSave()
      } else if (e.key === 'Escape') {
        handleCancel()
      }
    },
    [handleSave, handleCancel],
  )

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
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <button
              type="button"
              onClick={handleSave}
              className="p-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
              title={t('common:buttons.save', { defaultValue: 'Save' })}
            >
              <Check size={18} />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title={t('common:buttons.cancel', { defaultValue: 'Cancel' })}
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div>
            <span className="font-medium text-gray-900 dark:text-white truncate block">
              {scene.displayName}
            </span>
            {scene.displayName !== scene.obsSceneName && (
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate block">
                {scene.obsSceneName}
              </span>
            )}
          </div>
        )}
      </div>

      {!isEditing && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleVisibility}
            className={`
              p-2 rounded-lg transition-colors
              ${
                scene.isVisible
                  ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                  : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }
            `}
            title={scene.isVisible ? t('scenes.visible') : t('scenes.hidden')}
          >
            {scene.isVisible ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>

          <button
            type="button"
            onClick={handleEdit}
            className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
            title={t('common:buttons.edit', { defaultValue: 'Edit' })}
          >
            <Pencil size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
