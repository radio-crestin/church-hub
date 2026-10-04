import { describe, expect, mock, test } from 'bun:test'
import { isCoreMidiUsable } from '../isCoreMidiUsable'
import { warmUpCoreMidi } from '../warmUpCoreMidi'

// -304: CoreMIDI's answer while the macOS MIDI server is shutting down.
const MIDI_SERVER_GONE = -304

describe('isCoreMidiUsable', () => {
  test('never touches CoreMIDI on Windows or Linux', () => {
    const createClient = mock(() => MIDI_SERVER_GONE)
    expect(isCoreMidiUsable('win32', createClient)).toBe(true)
    expect(isCoreMidiUsable('linux', createClient)).toBe(true)
    expect(createClient).not.toHaveBeenCalled()
  })

  test('allows MIDI when CoreMIDI gives a client', () => {
    expect(isCoreMidiUsable('darwin', () => 0)).toBe(true)
  })

  test('turns MIDI off instead of crashing when CoreMIDI refuses', () => {
    expect(isCoreMidiUsable('darwin', () => MIDI_SERVER_GONE)).toBe(false)
  })

  test('turns MIDI off when CoreMIDI cannot be loaded', () => {
    const missingFramework = () => {
      throw new Error('dlopen failed')
    }
    expect(isCoreMidiUsable('darwin', missingFramework)).toBe(false)
  })
})

describe('warmUpCoreMidi', () => {
  test('retries in a new helper until one gets a client', async () => {
    let attempts = 0
    const refusedOnce = mock(async () => {
      attempts++
      if (attempts === 1) throw new Error('helper exited with code 2')
    })
    expect(await warmUpCoreMidi(refusedOnce)).toBe(true)
    expect(refusedOnce).toHaveBeenCalledTimes(2)
  })

  test('gives up after a few refusals', async () => {
    const alwaysRefused = mock(async () => {
      throw new Error('helper exited with code 2')
    })
    expect(await warmUpCoreMidi(alwaysRefused)).toBe(false)
    expect(alwaysRefused).toHaveBeenCalledTimes(4)
  })
})
