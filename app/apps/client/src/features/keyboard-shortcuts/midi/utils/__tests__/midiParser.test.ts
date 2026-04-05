import { describe, expect, it } from 'vitest'

import { MIDI_CONTROL_CHANGE, MIDI_NOTE_OFF, MIDI_NOTE_ON } from '../../types'
import {
  formatMIDIShortcutForDisplay,
  getMIDIShortcutNoteNumber,
  isMIDIShortcut,
  midiMessageToShortcutString,
  parseMIDIMessage,
  parseMIDIShortcutString,
} from '../midiParser'

describe('midi/utils/midiParser', () => {
  describe('parseMIDIMessage', () => {
    it('parses Note On message', () => {
      // Note On, channel 0, note 60, velocity 127
      const data = new Uint8Array([MIDI_NOTE_ON | 0x00, 60, 127])
      const msg = parseMIDIMessage(data)
      expect(msg).not.toBeNull()
      expect(msg!.type).toBe('note_on')
      expect(msg!.channel).toBe(0)
      expect(msg!.note).toBe(60)
      expect(msg!.value).toBe(127)
    })

    it('parses Note On with velocity 0 as Note Off', () => {
      const data = new Uint8Array([MIDI_NOTE_ON | 0x00, 60, 0])
      const msg = parseMIDIMessage(data)
      expect(msg!.type).toBe('note_off')
      expect(msg!.value).toBe(0)
    })

    it('parses Note Off message', () => {
      const data = new Uint8Array([MIDI_NOTE_OFF | 0x02, 48, 64])
      const msg = parseMIDIMessage(data)
      expect(msg!.type).toBe('note_off')
      expect(msg!.channel).toBe(2)
      expect(msg!.note).toBe(48)
      expect(msg!.value).toBe(64)
    })

    it('parses Control Change message', () => {
      const data = new Uint8Array([MIDI_CONTROL_CHANGE | 0x00, 6, 100])
      const msg = parseMIDIMessage(data)
      expect(msg!.type).toBe('control_change')
      expect(msg!.channel).toBe(0)
      expect(msg!.controller).toBe(6)
      expect(msg!.value).toBe(100)
    })

    it('returns null for data shorter than 3 bytes', () => {
      expect(parseMIDIMessage(new Uint8Array([0x90]))).toBeNull()
      expect(parseMIDIMessage(new Uint8Array([0x90, 60]))).toBeNull()
      expect(parseMIDIMessage(new Uint8Array([]))).toBeNull()
    })

    it('returns null for unsupported message types', () => {
      // Program Change (0xC0)
      const data = new Uint8Array([0xc0, 5, 0])
      expect(parseMIDIMessage(data)).toBeNull()
    })

    it('extracts channel from Note On on channel 15', () => {
      const data = new Uint8Array([MIDI_NOTE_ON | 0x0f, 36, 100])
      const msg = parseMIDIMessage(data)
      expect(msg!.channel).toBe(15)
    })

    it('includes a timestamp', () => {
      const data = new Uint8Array([MIDI_NOTE_ON, 60, 100])
      const msg = parseMIDIMessage(data)
      expect(msg!.timestamp).toBeGreaterThan(0)
    })
  })

  describe('midiMessageToShortcutString', () => {
    it('converts note_on message to shortcut', () => {
      const result = midiMessageToShortcutString({
        type: 'note_on',
        channel: 0,
        note: 36,
        value: 127,
        timestamp: 0,
      })
      expect(result).toBe('midi:note_on:36')
    })

    it('converts note_off message to shortcut', () => {
      const result = midiMessageToShortcutString({
        type: 'note_off',
        channel: 0,
        note: 48,
        value: 0,
        timestamp: 0,
      })
      expect(result).toBe('midi:note_off:48')
    })

    it('converts control_change message to shortcut', () => {
      const result = midiMessageToShortcutString({
        type: 'control_change',
        channel: 0,
        controller: 6,
        value: 127,
        timestamp: 0,
      })
      expect(result).toBe('midi:cc:6')
    })
  })

  describe('parseMIDIShortcutString', () => {
    it('parses note_on shortcut', () => {
      const result = parseMIDIShortcutString('midi:note_on:36')
      expect(result).toEqual({ type: 'note_on', number: 36 })
    })

    it('parses note_off shortcut', () => {
      const result = parseMIDIShortcutString('midi:note_off:48')
      expect(result).toEqual({ type: 'note_off', number: 48 })
    })

    it('parses cc shortcut', () => {
      const result = parseMIDIShortcutString('midi:cc:6')
      expect(result).toEqual({ type: 'control_change', number: 6 })
    })

    it('returns null for non-MIDI shortcuts', () => {
      expect(parseMIDIShortcutString('F1')).toBeNull()
      expect(parseMIDIShortcutString('Ctrl+A')).toBeNull()
    })

    it('returns null for invalid MIDI shortcut format', () => {
      expect(parseMIDIShortcutString('midi:invalid:abc')).toBeNull()
    })

    it('returns null for NaN number', () => {
      expect(parseMIDIShortcutString('midi:note_on:abc')).toBeNull()
    })
  })

  describe('isMIDIShortcut', () => {
    it('returns true for MIDI shortcuts', () => {
      expect(isMIDIShortcut('midi:note_on:36')).toBe(true)
      expect(isMIDIShortcut('midi:cc:6')).toBe(true)
    })

    it('returns false for non-MIDI shortcuts', () => {
      expect(isMIDIShortcut('F1')).toBe(false)
      expect(isMIDIShortcut('Ctrl+A')).toBe(false)
      expect(isMIDIShortcut('')).toBe(false)
    })
  })

  describe('formatMIDIShortcutForDisplay', () => {
    it('formats note_on shortcut', () => {
      expect(formatMIDIShortcutForDisplay('midi:note_on:36')).toBe(
        'MIDI Note 36',
      )
    })

    it('formats note_off shortcut', () => {
      expect(formatMIDIShortcutForDisplay('midi:note_off:48')).toBe(
        'MIDI Note Off 48',
      )
    })

    it('formats cc shortcut', () => {
      expect(formatMIDIShortcutForDisplay('midi:cc:6')).toBe('MIDI CC 6')
    })

    it('returns original string for invalid MIDI shortcut', () => {
      expect(formatMIDIShortcutForDisplay('F1')).toBe('F1')
    })
  })

  describe('getMIDIShortcutNoteNumber', () => {
    it('extracts note number from note_on', () => {
      expect(getMIDIShortcutNoteNumber('midi:note_on:36')).toBe(36)
    })

    it('extracts number from cc', () => {
      expect(getMIDIShortcutNoteNumber('midi:cc:6')).toBe(6)
    })

    it('returns null for non-MIDI shortcut', () => {
      expect(getMIDIShortcutNoteNumber('F1')).toBeNull()
    })

    it('returns null for invalid format', () => {
      expect(getMIDIShortcutNoteNumber('midi:bad:xyz')).toBeNull()
    })
  })
})
