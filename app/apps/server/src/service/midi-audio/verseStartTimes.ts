/**
 * When each slide of a song starts in its MIDI audio, in seconds. Synced
 * times (tapped while listening) win where set; without them the song is
 * split evenly, one slide per pass of the tune, the way hymn MIDI files play
 * a stanza per pass.
 */
export function verseStartTimes(
  slideCount: number,
  durationSeconds: number,
  syncedTimes: readonly number[] | null,
): number[] {
  if (syncedTimes && syncedTimes.length === slideCount) return [...syncedTimes]
  const slideSeconds = durationSeconds / Math.max(1, slideCount)
  return Array.from({ length: slideCount }, (_, index) => index * slideSeconds)
}

/** The slide showing at a playback position. */
export function slideAtTime(
  startTimes: readonly number[],
  seconds: number,
): number {
  let slide = 0
  startTimes.forEach((start, index) => {
    if (seconds >= start) slide = index
  })
  return slide
}
