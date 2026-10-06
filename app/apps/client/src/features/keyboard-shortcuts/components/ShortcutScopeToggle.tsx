import { AppWindow, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAppShortcuts } from '../hooks/useAppShortcuts'
import type { ShortcutKind } from '../types'
import { shortcutScope, withShortcutScope } from '../utils/shortcutScope'

interface ShortcutScopeToggleProps {
  shortcut: string
  kind: ShortcutKind
}

/**
 * Switches one key between working only inside Church Hub and working from any
 * program. Saved at once, for that key wherever it is bound.
 */
export function ShortcutScopeToggle({
  shortcut,
  kind,
}: ShortcutScopeToggleProps) {
  const { t } = useTranslation('settings')
  const { shortcuts, isLoading, isSaving, updateFullConfig } = useAppShortcuts()
  const isSystem = shortcutScope(shortcuts, shortcut, kind) === 'system'
  const label = t(
    isSystem
      ? 'sections.shortcuts.scope.system'
      : 'sections.shortcuts.scope.app',
  )
  const Icon = isSystem ? Globe : AppWindow

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isSystem}
      aria-label={t('sections.shortcuts.scope.toggle', { shortcut })}
      title={t(
        isSystem
          ? 'sections.shortcuts.scope.systemHint'
          : 'sections.shortcuts.scope.appHint',
      )}
      disabled={isLoading || isSaving}
      onClick={() =>
        updateFullConfig(
          withShortcutScope(shortcuts, shortcut, isSystem ? 'app' : 'system'),
        )
      }
      className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
        isSystem
          ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
          : 'border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200'
      }`}
    >
      <Icon size={14} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
