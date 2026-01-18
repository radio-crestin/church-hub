import { useCallback, useRef } from 'react'

import { useAppShortcuts } from '../../hooks'
import { MIDIProvider } from '../context'
import type { MIDIConfig } from '../types'
import { DEFAULT_MIDI_CONFIG } from '../types'

interface MIDISettingsProviderProps {
  children: React.ReactNode
}

/**
 * Wrapper component that connects MIDIProvider to app settings
 * Handles loading MIDI config from settings and persisting changes
 *
 * IMPORTANT: Always renders MIDIProvider to prevent unmount/remount cycles
 * which would reset LED states. Uses a stable config reference while loading
 * to avoid triggering unnecessary reconnections.
 */
export function MIDISettingsProvider({ children }: MIDISettingsProviderProps) {
  const { midiConfig, updateMIDIConfig, isLoading } = useAppShortcuts()

  // Keep a stable reference to the last valid config to prevent
  // MIDIProvider from resetting when transitioning between loading states
  const lastValidConfigRef = useRef<MIDIConfig>(DEFAULT_MIDI_CONFIG)

  // Update the stable config reference when we have loaded config
  if (!isLoading && midiConfig) {
    lastValidConfigRef.current = midiConfig
  }

  const handleConfigChange = useCallback(
    (config: MIDIConfig) => {
      updateMIDIConfig(config)
    },
    [updateMIDIConfig],
  )

  // Always render MIDIProvider to prevent unmount/remount cycles
  // Use the last valid config while loading to maintain stable state
  const stableConfig = isLoading ? lastValidConfigRef.current : midiConfig

  return (
    <MIDIProvider
      initialConfig={stableConfig}
      onConfigChange={handleConfigChange}
    >
      {children}
    </MIDIProvider>
  )
}
