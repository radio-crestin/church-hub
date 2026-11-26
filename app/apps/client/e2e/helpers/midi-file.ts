/** Ticks per quarter note; at the default 120 BPM a quarter note is 0.5 s. */
const DIVISION = 480

/** A MIDI variable-length quantity. */
function varLength(value: number): number[] {
  const bytes = [value & 0x7f]
  for (let rest = value >> 7; rest > 0; rest >>= 7) {
    bytes.unshift((rest & 0x7f) | 0x80)
  }
  return bytes
}

/**
 * A small Standard MIDI File (format 0, piano at 120 BPM) that plays a
 * C-major scale up and down, one quarter note (0.5 s) each, for `seconds`.
 */
export function buildMidiFile(seconds: number): Buffer {
  const scale = [60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62]
  const events: number[] = [
    // Tempo: 500 000 µs per quarter note.
    0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20,
    // Program change: acoustic grand piano.
    0x00, 0xc0, 0x00,
  ]
  for (let i = 0; i < seconds * 2; i++) {
    const note = scale[i % scale.length] as number
    events.push(0x00, 0x90, note, 0x64)
    events.push(...varLength(DIVISION), 0x80, note, 0x40)
  }
  events.push(0x00, 0xff, 0x2f, 0x00)

  const header = Buffer.from([
    0x4d,
    0x54,
    0x68,
    0x64,
    0,
    0,
    0,
    6,
    0,
    0,
    0,
    1,
    DIVISION >> 8,
    DIVISION & 0xff,
  ])
  const trackLength = Buffer.alloc(4)
  trackLength.writeUInt32BE(events.length)
  return Buffer.concat([
    header,
    Buffer.from([0x4d, 0x54, 0x72, 0x6b]),
    trackLength,
    Buffer.from(events),
  ])
}
