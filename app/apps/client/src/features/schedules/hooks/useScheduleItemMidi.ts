import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  removeScheduleItemMidi,
  setScheduleItemMidiVerseTimes,
  uploadScheduleItemMidi,
} from '../service'

/**
 * Attaching, syncing and removing a song item's MIDI file; each refetches
 * the presentation, so the item shows its new state.
 */
export function useScheduleItemMidi(scheduleId: number, itemId: number) {
  const queryClient = useQueryClient()
  const onSettled = () =>
    queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] })

  const upload = useMutation({
    mutationFn: (file: File) =>
      uploadScheduleItemMidi(scheduleId, itemId, file),
    onSettled,
  })
  const remove = useMutation({
    mutationFn: () => removeScheduleItemMidi(scheduleId, itemId),
    onSettled,
  })
  const setVerseTimes = useMutation({
    mutationFn: (verseTimes: number[] | null) =>
      setScheduleItemMidiVerseTimes(scheduleId, itemId, verseTimes),
    onSettled,
  })
  return { upload, remove, setVerseTimes }
}
