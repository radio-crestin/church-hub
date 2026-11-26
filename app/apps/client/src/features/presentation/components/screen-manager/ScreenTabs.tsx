import { useTranslation } from 'react-i18next'

import type { Screen } from '../../types'

interface ScreenTabsProps {
  screens: Screen[]
  selectedId: number
  onSelect: (screenId: number) => void
}

/**
 * One tab per screen, like the displays of a projection program: its name,
 * what it is, and a dot that is green while its window is open.
 */
export function ScreenTabs({ screens, selectedId, onSelect }: ScreenTabsProps) {
  const { t } = useTranslation(['settings', 'presentation'])

  return (
    <div
      role="tablist"
      aria-label={t('settings:sections.screens.title')}
      className="flex gap-2 overflow-x-auto pb-1"
    >
      {screens.map((screen) => {
        const selected = screen.id === selectedId
        return (
          <button
            key={screen.id}
            type="button"
            role="tab"
            aria-selected={selected}
            data-testid="screen-tab"
            data-screen-id={screen.id}
            onClick={() => onSelect(screen.id)}
            className={`flex min-w-36 shrink-0 items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
              selected
                ? 'border-line bg-selected'
                : 'border-line hover:bg-hover'
            }`}
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                screen.isActive ? 'bg-ok' : 'bg-fg-hint'
              }`}
              title={
                screen.isActive
                  ? t('settings:sections.screens.status.open')
                  : t('settings:sections.screens.status.closed')
              }
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-fg">
                {screen.name}
              </span>
              <span className="block truncate text-xs text-fg-hint">
                {t(`presentation:screens.screenTypes.${screen.type}`)}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
