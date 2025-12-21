/**
 * MIDI device information
 */
export interface MIDIDevice {
  id: number
  name: string
  type: 'input' | 'output'
}

/**
 * MIDI input message from a device
 */
export interface MIDIInputMessage {
  type: 'note_on' | 'note_off' | 'control_change'
  channel: number
  note?: number
  controller?: number
  value: number
  timestamp: number
}

/**
 * MIDI configuration stored in settings
 */
export interface MIDIConfig {
  enabled: boolean
  inputDeviceId: number | null
  outputDeviceId: number | null
}

/**
 * Default MIDI configuration
 */
export const DEFAULT_MIDI_CONFIG: MIDIConfig = {
  enabled: false,
  inputDeviceId: null,
  outputDeviceId: null,
}

/**
 * MIDI LED control constants
 */
export const LED_VELOCITY_ON = 0x01
export const LED_VELOCITY_OFF = 0x00

/**
 * Shortcut string prefix for MIDI shortcuts
 */
export const MIDI_SHORTCUT_PREFIX = 'midi:'
