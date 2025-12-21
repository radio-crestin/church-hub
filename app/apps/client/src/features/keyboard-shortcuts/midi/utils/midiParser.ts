import {
  MIDI_CONTROL_CHANGE,
  MIDI_NOTE_OFF,
  MIDI_NOTE_ON,
  MIDI_SHORTCUT_PREFIX,
  type MIDIMessage,
} from '../types'

/**
 * Parse raw MIDI bytes into a MIDIMessage object
 */
export function parseMIDIMessage(data: Uint8Array): MIDIMessage | null {
  if (data.length < 3) return null

  const statusByte = data[0]
  const messageType = statusByte & 0xf0
  const channel = statusByte & 0x0f
  const data1 = data[1]
  const data2 = data[2]

  switch (messageType) {
    case MIDI_NOTE_ON:
      // Note On with velocity 0 is treated as Note Off
      if (data2 === 0) {
        return {
          type: 'note_off',
          channel,
          note: data1,
          value: 0,
          timestamp: Date.now(),
        }
      }
      return {
        type: 'note_on',
        channel,
        note: data1,
        value: data2,
        timestamp: Date.now(),
      }

    case MIDI_NOTE_OFF:
      return {
        type: 'note_off',
        channel,
        note: data1,
        value: data2,
        timestamp: Date.now(),
      }

    case MIDI_CONTROL_CHANGE:
      return {
        type: 'control_change',
        channel,
        controller: data1,
        value: data2,
        timestamp: Date.now(),
      }

    default:
      return null
  }
}

/**
 * Convert a MIDIMessage to a shortcut string
 * Format: "midi:note_on:36" or "midi:cc:6"
 */
export function midiMessageToShortcutString(msg: MIDIMessage): string {
  switch (msg.type) {
    case 'note_on':
      return `${MIDI_SHORTCUT_PREFIX}note_on:${msg.note}`
    case 'note_off':
      return `${MIDI_SHORTCUT_PREFIX}note_off:${msg.note}`
    case 'control_change':
      return `${MIDI_SHORTCUT_PREFIX}cc:${msg.controller}`
    default:
      return ''
  }
}

/**
 * Parse a MIDI shortcut string back to its components
 */
export function parseMIDIShortcutString(shortcut: string): {
  type: 'note_on' | 'note_off' | 'control_change'
  number: number
} | null {
  if (!isMIDIShortcut(shortcut)) return null

  const withoutPrefix = shortcut.slice(MIDI_SHORTCUT_PREFIX.length)
  const [typeStr, numberStr] = withoutPrefix.split(':')

  const number = parseInt(numberStr, 10)
  if (isNaN(number)) return null

  switch (typeStr) {
    case 'note_on':
      return { type: 'note_on', number }
    case 'note_off':
      return { type: 'note_off', number }
    case 'cc':
      return { type: 'control_change', number }
    default:
      return null
  }
}

/**
 * Check if a shortcut string is a MIDI shortcut
 */
export function isMIDIShortcut(shortcut: string): boolean {
  return shortcut.startsWith(MIDI_SHORTCUT_PREFIX)
}

/**
 * Format a MIDI shortcut for display
 * "midi:note_on:36" -> "MIDI Note 36"
 * "midi:cc:6" -> "MIDI CC 6"
 */
export function formatMIDIShortcutForDisplay(shortcut: string): string {
  const parsed = parseMIDIShortcutString(shortcut)
  if (!parsed) return shortcut

  switch (parsed.type) {
    case 'note_on':
      return `MIDI Note ${parsed.number}`
    case 'note_off':
      return `MIDI Note Off ${parsed.number}`
    case 'control_change':
      return `MIDI CC ${parsed.number}`
    default:
      return shortcut
  }
}

/**
 * Extract the note/controller number from a MIDI shortcut for LED control
 */
export function getMIDIShortcutNoteNumber(shortcut: string): number | null {
  const parsed = parseMIDIShortcutString(shortcut)
  if (!parsed) return null

  return parsed.number
}
