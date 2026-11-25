import { fetcher } from '~/utils/fetcher'
import type { ScheduleItemMidi } from '../types'

interface ApiResponse<T> {
  data?: T
  error?: string
}

/** Rendering a long MIDI file to audio the first time takes a while. */
const PLAY_TIMEOUT_MS = 120_000

function midiUrl(scheduleId: number, itemId: number, action = ''): string {
  return `/api/schedules/${scheduleId}/items/${itemId}/midi${action}`
}

function unwrap<T>(response: ApiResponse<T>): T {
  if (response.error) throw new Error(response.error)
  return response.data as T
}

/** Attaches a MIDI file to a song item (replacing its old one). */
export async function uploadScheduleItemMidi(
  scheduleId: number,
  itemId: number,
  file: File,
): Promise<ScheduleItemMidi> {
  const name = encodeURIComponent(file.name)
  return unwrap(
    await fetcher<ApiResponse<ScheduleItemMidi>>(
      `${midiUrl(scheduleId, itemId)}?name=${name}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/midi' },
        body: file,
      },
    ),
  )
}

export async function removeScheduleItemMidi(
  scheduleId: number,
  itemId: number,
): Promise<void> {
  unwrap(
    await fetcher<ApiResponse<null>>(midiUrl(scheduleId, itemId), {
      method: 'DELETE',
    }),
  )
}

/** Saves the second each slide starts at; null splits the song evenly. */
export async function setScheduleItemMidiVerseTimes(
  scheduleId: number,
  itemId: number,
  verseTimes: number[] | null,
): Promise<ScheduleItemMidi> {
  return unwrap(
    await fetcher<ApiResponse<ScheduleItemMidi>>(
      midiUrl(scheduleId, itemId, '/verse-times'),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verseTimes }),
      },
    ),
  )
}

/** Plays the item's MIDI from a second on; false with no audio server. */
export async function playScheduleItemMidi(
  scheduleId: number,
  itemId: number,
  fromSeconds = 0,
): Promise<boolean> {
  const data = unwrap(
    await fetcher<ApiResponse<{ audible: boolean }>>(
      midiUrl(scheduleId, itemId, '/play'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromSeconds }),
        timeout: PLAY_TIMEOUT_MS,
      },
    ),
  )
  return data.audible
}

export async function stopScheduleItemMidi(
  scheduleId: number,
  itemId: number,
): Promise<void> {
  unwrap(
    await fetcher<ApiResponse<{ stopped: boolean }>>(
      midiUrl(scheduleId, itemId, '/stop'),
      { method: 'POST' },
    ),
  )
}
