// Context

// Components
export { MIDIDeviceSelector, MIDISettingsProvider } from './components'
export { MIDIProvider, useMIDI, useMIDIOptional } from './context'
// Hooks
export { useMIDILEDFeedback, useMIDIShortcuts } from './hooks'
// Types
export type { MIDIConfig, MIDIDevice, MIDIMessage } from './types'
export {
  DEFAULT_MIDI_CONFIG,
  LED_VELOCITY_OFF,
  LED_VELOCITY_ON,
  MIDI_CONTROL_CHANGE,
  MIDI_NOTE_OFF,
  MIDI_NOTE_ON,
  MIDI_SHORTCUT_PREFIX,
} from './types'
// Utils
export {
  formatMIDIShortcutForDisplay,
  getMIDIShortcutNoteNumber,
  isMIDIShortcut,
  midiMessageToShortcutString,
  parseMIDIMessage,
  parseMIDIShortcutString,
} from './utils'
