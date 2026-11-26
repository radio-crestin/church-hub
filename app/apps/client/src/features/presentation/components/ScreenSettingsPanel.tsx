import { ScreenManager } from './screen-manager/ScreenManager'

const cardClass = 'rounded-xl border border-line bg-panel p-3 sm:p-6'

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
