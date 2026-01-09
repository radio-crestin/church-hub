import { Disc3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { MIDIDeviceSelector, MIDISettingsProvider } from '../midi/components'

/**
 * Settings section for MIDI controller configuration.
 * Shortcuts configuration has been moved to individual feature settings:
 * - Sidebar navigation shortcuts -> Sidebar item settings
 * - Stream shortcuts -> Livestream settings
 * - Slide navigation shortcuts -> Presentation settings
 */
export function MIDISettingsSection() {
  const { t } = useTranslation('settings')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Disc3 size={24} className="text-indigo-600 dark:text-indigo-400" />
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('sections.midi.title', { defaultValue: 'MIDI Controller' })}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('sections.midi.description', {
              defaultValue:
                'Configure your MIDI controller to use hardware buttons for shortcuts.',
            })}
          </p>
        </div>
      </div>

      <MIDISettingsProvider>
        <MIDIDeviceSelector />
      </MIDISettingsProvider>
    </div>
  )
}
