/** The verse whose time has come at a playback position (0 before any). */
export function syncedVerseAt(times: readonly number[], seconds: number) {
  let verse = 0
  times.forEach((start, index) => {
    if (seconds >= start) verse = index
  })
  return verse
}
