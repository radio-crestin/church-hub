import type { ScheduleItemMidi } from './types'

interface MidiColumns {
  midiFile: string | null
  midiFileName: string | null
  midiDurationSeconds: number | null
  midiVerseTimes: string | null
}

/** An item's MIDI columns as the API sends them; null without a file. */
export function toScheduleItemMidi(
  record: MidiColumns,
): ScheduleItemMidi | null {
  if (!record.midiFile) return null
  return {
    hash: record.midiFile,
    fileName: record.midiFileName ?? '',
    durationSeconds: record.midiDurationSeconds ?? 0,
    verseTimes: record.midiVerseTimes
      ? (JSON.parse(record.midiVerseTimes) as number[])
      : null,
  }
}
