/**
 * Renders a MIDI file to audio off the server's main thread: a song takes
 * seconds of CPU. A separate entrypoint of the compiled sidecar
 * (scripts/workerEntrypoints.ts).
 */
import { renderMidiFile } from './renderMidiFile'
import type { RenderMidiJob } from './types'

declare const self: Worker

self.onmessage = async (event: MessageEvent<RenderMidiJob>) => {
  const { midiPath, soundFontPath, outPath } = event.data
  try {
    await renderMidiFile(midiPath, soundFontPath, outPath)
    self.postMessage({ type: 'done' })
  } catch (error) {
    self.postMessage({ type: 'failed', error: String(error) })
  }
}
