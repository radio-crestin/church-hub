/** "45 s", "3 min 20 s", "12 min": how long a presentation runs. */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds} s`
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`
}
