/**
 * MIDI Device representation
 */
export interface MIDIDevice {
  id: string
  name: string
  manufacturer: string
  state: 'connected' | 'disconnected'
}

/**
 * Parsed MIDI message
 */
export interface MIDIMessage {
  type: 'note_on' | 'note_off' | 'control_change'
  channel: number
  note?: number
  controller?: number
  value: number
  timestamp: number
}

/**
 * MIDI configuration stored in settings.
 *
 * Devices are identified by name, not index. The OS-assigned index can shift
 * when devices are plugged/unplugged in a different order, so persisting an
 * index would silently bind to the wrong controller after a reboot.
 */
export interface MIDIConfig {
  enabled: boolean
  inputDeviceName: string | null
  outputDeviceName: string | null
}

/**
 * MIDI status byte constants
 */
export const MIDI_NOTE_ON = 0x90
export const MIDI_NOTE_OFF = 0x80
export const MIDI_CONTROL_CHANGE = 0xb0

/**
 * LED velocity constants
 */
export const LED_VELOCITY_ON = 0x01
export const LED_VELOCITY_OFF = 0x00

/**
 * MIDI shortcut prefix
 */
export const MIDI_SHORTCUT_PREFIX = 'midi:'

/**
 * Default MIDI configuration
 */
export const DEFAULT_MIDI_CONFIG: MIDIConfig = {
  enabled: false,
  inputDeviceName: null,
  outputDeviceName: null,
}
