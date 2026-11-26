import { createLogger } from '../../utils/logger'
import {
  type MidiAudioPosition,
  midiAudioPosition,
  playMidiAudio,
  stopMidiAudio,
} from '../midi-audio'
import type { ScheduleItem } from '../schedules/types'

const logger = createLogger('schedule-automation')

/** The MIDI item the running presentation plays now. */
let playing: {
  itemId: number
  hash: string
  startedAt: number
  /** False with no audio server: the slides then follow the clock alone. */
  audible: boolean
} | null = null

/** Starts the item's MIDI audio, unless it is already the one playing. */
export async function startItemMidi(item: ScheduleItem): Promise<void> {
  const midi = item.midi
  if (!midi || playing?.itemId === item.id) return
  const audible = await playMidiAudio(
    midi.hash,
    item.song?.title ?? midi.fileName,
  )
  if (!audible)
    logger.warning('No audio server: the MIDI slides follow the clock')
  playing = { itemId: item.id, hash: midi.hash, startedAt: Date.now(), audible }
}

/** Where the item's MIDI audio is; `gone` when it isn't the one playing. */
export function itemMidiPosition(item: ScheduleItem): MidiAudioPosition {
  if (!playing || playing.itemId !== item.id) return { state: 'gone' }
  if (playing.audible) return midiAudioPosition(playing.hash)
  return { state: 'playing', seconds: (Date.now() - playing.startedAt) / 1000 }
}

/** When the item's MIDI audio started (epoch ms), if it is the one playing. */
export function itemMidiStartedAt(item: ScheduleItem): number | null {
  return playing?.itemId === item.id ? playing.startedAt : null
}

/** Forgets the MIDI item; `stop` also stops its audio. */
export async function endItemMidi({ stop }: { stop: boolean }): Promise<void> {
  const ended = playing
  playing = null
  if (stop && ended?.audible) await stopMidiAudio(ended.hash)
}
