import { dlopen } from 'bun:ffi'

const CORE_FOUNDATION_PATH =
  '/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation'
const CORE_MIDI_PATH = '/System/Library/Frameworks/CoreMIDI.framework/CoreMIDI'
const CF_STRING_ENCODING_UTF8 = 0x08000100

/**
 * Creates a CoreMIDI client for this process (macOS only) and returns
 * CoreMIDI's status code: 0 means the client exists.
 *
 * The MIDI native module (RtMidi) creates its client inside a function
 * declared `throw()`, so when CoreMIDI refuses (e.g. -304 while the MIDI
 * server is shutting down) it aborts the whole process. Calling
 * MIDIClientCreate ourselves first returns that error as a number instead.
 * The client is never disposed: it keeps the MIDI server alive for as long
 * as the app runs, so the native module's own client creation succeeds.
 */
export function createCoreMidiClient(): number {
  const coreFoundation = dlopen(CORE_FOUNDATION_PATH, {
    // CFStringRef may be a tagged pointer above 2^53: keep it as a u64 BigInt.
    CFStringCreateWithCString: { args: ['ptr', 'ptr', 'u32'], returns: 'u64' },
  })
  const coreMidi = dlopen(CORE_MIDI_PATH, {
    MIDIClientCreate: { args: ['u64', 'ptr', 'ptr', 'ptr'], returns: 'i32' },
  })

  const clientName = coreFoundation.symbols.CFStringCreateWithCString(
    null,
    Buffer.from('Church Hub\0'),
    CF_STRING_ENCODING_UTF8,
  )
  const clientRef = new Uint32Array(1)
  return coreMidi.symbols.MIDIClientCreate(clientName, null, null, clientRef)
}
