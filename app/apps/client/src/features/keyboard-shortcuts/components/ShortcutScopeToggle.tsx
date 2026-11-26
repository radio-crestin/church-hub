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
      className={`flex shrink-0 items-center gap-1.5 h-9 rounded-lg px-2.5 text-xs font-medium transition-colors hover:bg-hover disabled:opacity-50 ${
        isSystem ? 'bg-selected text-fg' : 'bg-field text-fg-label'
      }`}
    >
      <Icon size={14} strokeWidth={1.75} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
