import { readFileSync } from 'node:fs'
import { BasicMIDI } from 'spessasynth_core'

/** The MIDI file's length in seconds; throws on a file that isn't MIDI. */
export function readMidiDuration(path: string): number {
  const bytes = readFileSync(path)
  const midi = BasicMIDI.fromArrayBuffer(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  )
  return midi.duration
}
