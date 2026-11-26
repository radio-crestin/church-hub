import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import {
  audioToWav,
  BasicMIDI,
  SoundBankLoader,
  SpessaSynthProcessor,
  SpessaSynthSequencer,
} from 'spessasynth_core'

const SAMPLE_RATE = 44_100
/** Between modulator and LFO updates: spessasynth recommends a small one. */
const BLOCK_SIZE = 128
/** Lets the last notes ring out. */
const TAIL_SECONDS = 2

function toArrayBuffer(bytes: Buffer): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
}

/**
 * Renders a MIDI file to a stereo WAV with the SoundFont, the way
 * spessasynth_core's midi_to_wav example does. Written to a temporary file
 * first, so a cached WAV is always complete.
 */
export async function renderMidiFile(
  midiPath: string,
  soundFontPath: string,
  outPath: string,
): Promise<void> {
  const midi = BasicMIDI.fromArrayBuffer(toArrayBuffer(readFileSync(midiPath)))
  const synth = new SpessaSynthProcessor(SAMPLE_RATE, { eventsEnabled: false })
  synth.soundBankManager.addSoundBank(
    SoundBankLoader.fromArrayBuffer(toArrayBuffer(readFileSync(soundFontPath))),
    'main',
  )
  await synth.ready
  synth.setSystemParameter('autoAllocateVoices', true)

  const sequencer = new SpessaSynthSequencer(synth)
  sequencer.loadNewSongList([midi])
  sequencer.play()

  const samples = Math.ceil(SAMPLE_RATE * (midi.duration + TAIL_SECONDS))
  const left = new Float32Array(samples)
  const right = new Float32Array(samples)
  for (let filled = 0; filled < samples; filled += BLOCK_SIZE) {
    sequencer.processTick()
    synth.process(left, right, filled, Math.min(BLOCK_SIZE, samples - filled))
  }

  const partial = `${outPath}.partial`
  writeFileSync(partial, new Uint8Array(audioToWav([left, right], SAMPLE_RATE)))
  renameSync(partial, outPath)
}
