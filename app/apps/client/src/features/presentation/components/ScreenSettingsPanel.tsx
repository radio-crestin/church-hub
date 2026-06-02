import { ScreenManager } from './screen-manager/ScreenManager'

const cardClass =
  'rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900'

/**
 * Display/screens settings panel. Slide-navigation shortcuts moved to the
 * consolidated Shortcuts settings page (/settings/shortcuts).
 */
export function ScreenSettingsPanel() {
  return (
    <div className={`flex-1 ${cardClass}`}>
      <ScreenManager />
    </div>
  )
}
