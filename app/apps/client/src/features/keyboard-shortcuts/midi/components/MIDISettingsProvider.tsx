import { useCallback } from 'react'

import { useAppShortcuts } from '../../hooks'
import { MIDIProvider } from '../context'
import type { MIDIConfig } from '../types'

interface MIDISettingsProviderProps {
  children: React.ReactNode
}

/**
 * Wrapper component that connects MIDIProvider to app settings
 * Handles loading MIDI config from settings and persisting changes
 */
export function MIDISettingsProvider({ children }: MIDISettingsProviderProps) {
  const { midiConfig, updateMIDIConfig, isLoading } = useAppShortcuts()

  const handleConfigChange = useCallback(
    (config: MIDIConfig) => {
      updateMIDIConfig(config)
    },
    [updateMIDIConfig],
  )

  // Don't render MIDIProvider until settings are loaded
  if (isLoading) {
    return <>{children}</>
  }
  return (
    <MIDIProvider
      initialConfig={midiConfig}
      onConfigChange={handleConfigChange}
    >
      {children}
    </MIDIProvider>
  )
}
