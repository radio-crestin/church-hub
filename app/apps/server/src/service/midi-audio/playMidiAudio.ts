import { midiAudioPath } from './midiStore'
import { renderMidiAudio } from './renderMidiAudio'
import { executeCommand, getPlayerState, playAudioFile } from '../music-player'

/** Seconds from the end at which a stopped player counts as finished. */
const END_SLACK_SECONDS = 0.5

/**
 * Plays a MIDI file's audio through the music player (rendered first if it
 * isn't cached yet). False when there is no audio server to play it on.
 */
export async function playMidiAudio(
  hash: string,
  title: string,
): Promise<boolean> {
  return playAudioFile(await renderMidiAudio(hash), title)
}

export type MidiAudioPosition =
  | { state: 'playing'; seconds: number }
  | { state: 'paused' }
  /** Ended, stopped, or the player moved on to other music. */
  | { state: 'gone' }

/**
 * Where the player is in the MIDI file's audio. Between the player's state
 * polls the position is carried on by the clock.
 */
export function midiAudioPosition(hash: string): MidiAudioPosition {
  const player = getPlayerState()
  if (player.currentTrack?.path !== midiAudioPath(hash))
    return { state: 'gone' }
  if (player.isPlaying) {
    const sincePoll = (Date.now() - player.updatedAt) / 1000
    return { state: 'playing', seconds: player.currentTime + sincePoll }
  }
  const ended =
    player.duration > 0 &&
    player.currentTime >= player.duration - END_SLACK_SECONDS
  return ended || player.currentTime === 0
    ? { state: 'gone' }
    : { state: 'paused' }
}

/** Stops the player if it is playing this MIDI file's audio. */
export async function stopMidiAudio(hash: string): Promise<void> {
  if (getPlayerState().currentTrack?.path !== midiAudioPath(hash)) return
  await executeCommand({ type: 'stop' })
}
