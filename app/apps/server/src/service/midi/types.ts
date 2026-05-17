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
 * MIDI configuration stored in settings.
 *
 * Devices are identified by name, not index. The OS-assigned index can change
 * when devices are plugged/unplugged in a different order, so persisting an
 * index would silently bind to the wrong controller after a reboot. Names are
 * stable per device (or close enough that the user can re-select intentionally).
 */
export interface MIDIConfig {
  enabled: boolean
  inputDeviceName: string | null
  outputDeviceName: string | null
}

/**
 * Default MIDI configuration
 */
export const DEFAULT_MIDI_CONFIG: MIDIConfig = {
  enabled: false,
  inputDeviceName: null,
  outputDeviceName: null,
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
