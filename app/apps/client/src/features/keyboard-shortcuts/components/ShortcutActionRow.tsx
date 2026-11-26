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
import { validateGlobalShortcut } from '../utils'

interface ShortcutActionRowProps {
  action: ShortcutActionMeta
  config: ShortcutActionConfig
  allShortcuts: GlobalShortcutsConfig
  onUpdate: (config: ShortcutActionConfig) => void
}

export function ShortcutActionRow({
  action,
  config,
  allShortcuts,
  onUpdate,
}: ShortcutActionRowProps) {
  const { t } = useTranslation('settings')
  const [errors, setErrors] = useState<Record<number, string>>({})

  const Icon = action.icon

  const validateShortcut = useCallback(
    (shortcut: string): ShortcutConflict | null => {
      return validateGlobalShortcut(shortcut, allShortcuts, action.id)
    },
    [action.id, allShortcuts],
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
    <div className="border border-line bg-panel rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Icon
            size={16}
            strokeWidth={1.5}
            className="shrink-0 text-fg-label"
          />
          <div>
            <h4 className="text-sm font-medium text-fg">
              {t(action.labelKey)}
            </h4>
            <p className="text-xs text-fg-hint">{t(action.descriptionKey)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggleEnabled}
          className={`
            inline-flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-lg bg-field hover:bg-hover transition-colors
            ${config.enabled ? 'text-fg' : 'text-fg-hint'}
          `}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${config.enabled ? 'bg-ok' : 'bg-fg-hint'}`}
          />
          {config.enabled
            ? t('sections.shortcuts.enabled')
            : t('sections.shortcuts.disabled')}
        </button>
      </div>

      <div className="space-y-2">
        {config.shortcuts.length === 0 ? (
          <p className="text-sm text-fg-hint">
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
                scopeKind="action"
              />
              {errors[index] && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {errors[index]}
                </p>
              )}
            </div>
          ))
        )}

        <button
          type="button"
          onClick={handleAddShortcut}
          className="flex items-center gap-2 h-8 px-2 -mx-2 rounded-lg text-sm text-fg-label hover:bg-hover hover:text-fg transition-colors mt-2"
        >
          <Plus size={16} strokeWidth={1.5} />
          {t('sections.shortcuts.addShortcut')}
        </button>
      </div>
    </div>
  )
}
