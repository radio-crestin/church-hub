import { Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ShortcutRecorder } from './ShortcutRecorder'
import type {
  GlobalShortcutsConfig,
  ShortcutActionConfig,
  ShortcutActionMeta,
  ShortcutConflict,
} from '../types'
import { type SceneShortcutSource, validateGlobalShortcut } from '../utils'

interface ShortcutActionRowProps {
  action: ShortcutActionMeta
  config: ShortcutActionConfig
  allShortcuts: GlobalShortcutsConfig
  scenes: SceneShortcutSource[]
  onUpdate: (config: ShortcutActionConfig) => void
}

export function ShortcutActionRow({
  action,
  config,
  allShortcuts,
  scenes,
  onUpdate,
}: ShortcutActionRowProps) {
  const { t } = useTranslation('settings')
  const [errors, setErrors] = useState<Record<number, string>>({})

  const Icon = action.icon

  const validateShortcut = useCallback(
    (shortcut: string): ShortcutConflict | null => {
      return validateGlobalShortcut(shortcut, action.id, allShortcuts, scenes)
    },
    [action.id, allShortcuts, scenes],
  )

  const getConflictMessage = useCallback(
    (conflict: ShortcutConflict): string => {
      if (conflict.conflictSource === 'global') {
        const actionLabel = t(
          `sections.shortcuts.actions.${conflict.conflictName}.label`,
        )
        return t('sections.shortcuts.conflicts.global', { action: actionLabel })
      }
      return t('sections.shortcuts.conflicts.scene', {
        scene: conflict.conflictName,
      })
    },
    [t],
  )

  const handleAddShortcut = useCallback(() => {
    onUpdate({
      ...config,
      shortcuts: [...config.shortcuts, ''],
    })
  }, [config, onUpdate])

  const handleRemoveShortcut = useCallback(
    (index: number) => {
      const newShortcuts = config.shortcuts.filter((_, i) => i !== index)
      onUpdate({
        ...config,
        shortcuts: newShortcuts,
      })
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[index]
        return newErrors
      })
    },
    [config, onUpdate],
  )

  const handleUpdateShortcut = useCallback(
    (index: number, value: string) => {
      const newShortcuts = [...config.shortcuts]
      newShortcuts[index] = value
      onUpdate({
        ...config,
        shortcuts: newShortcuts,
      })

      const conflict = validateShortcut(value)
      if (conflict) {
        setErrors((prev) => ({
          ...prev,
          [index]: getConflictMessage(conflict),
        }))
      } else {
        setErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors[index]
          return newErrors
        })
      }
    },
    [config, onUpdate, validateShortcut, getConflictMessage],
  )

  const handleToggleEnabled = useCallback(() => {
    onUpdate({
      ...config,
      enabled: !config.enabled,
    })
  }, [config, onUpdate])

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
            <Icon size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              {t(action.labelKey)}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t(action.descriptionKey)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggleEnabled}
          className={`
            px-3 py-1 text-xs font-medium rounded-full transition-colors
            ${
              config.enabled
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            }
          `}
        >
          {config.enabled
            ? t('sections.shortcuts.enabled')
            : t('sections.shortcuts.disabled')}
        </button>
      </div>

      <div className="space-y-2">
        {config.shortcuts.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">
            {t('sections.shortcuts.noShortcuts')}
          </p>
        ) : (
          config.shortcuts.map((shortcut, index) => (
            <div key={index}>
              <ShortcutRecorder
                value={shortcut}
                onChange={(value) => handleUpdateShortcut(index, value)}
                onRemove={() => handleRemoveShortcut(index)}
                error={errors[index]}
                namespace="settings"
              />
              {errors[index] && (
                <p className="mt-1 text-xs text-red-500">{errors[index]}</p>
              )}
            </div>
          ))
        )}

        <button
          type="button"
          onClick={handleAddShortcut}
          className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mt-2"
        >
          <Plus size={16} />
          {t('sections.shortcuts.addShortcut')}
        </button>
      </div>
    </div>
  )
}
