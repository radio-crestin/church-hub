const DAY_MS = 24 * 60 * 60 * 1000

/**
 * When a track was last played, as people say it: today, yesterday, 3 days
 * ago, then the date ("12 dec.", with the year once it is another year).
 */
export function formatLastPlayed(
  timestamp: number,
  language: string,
  now = new Date(),
): string {
  const played = new Date(timestamp)
  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(played)) / DAY_MS)

  if (days < 7) {
    return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(
      -days,
      'day',
    )
  }
  return played.toLocaleDateString(language, {
    day: 'numeric',
    month: 'short',
    ...(played.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  })
}
