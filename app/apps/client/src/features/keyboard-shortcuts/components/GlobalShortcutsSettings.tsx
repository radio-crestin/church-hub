import { ShortcutActionRow } from './ShortcutActionRow'
import { useAppShortcuts } from '../hooks'
import type { ShortcutActionMeta } from '../types'

interface GlobalShortcutsSettingsProps {
  actions: ShortcutActionMeta[]
}

/** Renders a list of global-action shortcut rows backed by useAppShortcuts. */
export function GlobalShortcutsSettings({
  actions,
}: GlobalShortcutsSettingsProps) {
  const { shortcuts, updateActionShortcuts } = useAppShortcuts()

  return (
    <div className="space-y-3">
      {actions.map((action) => (
        <ShortcutActionRow
          key={action.id}
          action={action}
          config={
            shortcuts.actions[action.id] ?? { shortcuts: [], enabled: true }
          }
          allShortcuts={shortcuts}
          onUpdate={(config) => updateActionShortcuts(action.id, config)}
        />
      ))}
    </div>
  )
}
