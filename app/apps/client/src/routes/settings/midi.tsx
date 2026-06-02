import { createFileRoute } from '@tanstack/react-router'

import { MIDISettingsSection } from '~/features/keyboard-shortcuts'
import { SettingsLeafGuard, SettingsSection } from '~/features/settings'

export const Route = createFileRoute('/settings/midi')({
  component: MidiSettings,
})

function MidiSettings() {
  return (
    <SettingsLeafGuard itemId="midi">
      <SettingsSection>
        <MIDISettingsSection />
      </SettingsSection>
    </SettingsLeafGuard>
  )
}
