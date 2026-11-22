const MONTHS: ReadonlyArray<readonly [ro: string, en: string]> = [
  ['ianuarie', 'january'],
  ['februarie', 'february'],
  ['martie', 'march'],
  ['aprilie', 'april'],
  ['mai', 'may'],
  ['iunie', 'june'],
  ['iulie', 'july'],
  ['august', 'august'],
  ['septembrie', 'september'],
  ['octombrie', 'october'],
  ['noiembrie', 'november'],
  ['decembrie', 'december'],
]
const MONTH_NAMES = MONTHS.flat().join('|')

/** `value` with as many digits as `like` (zero-padded, or the last two of a year). */
function sameWidth(value: number, like: string): string {
  return String(value).padStart(like.length, '0').slice(-like.length)
}

/** `name` in the language and capitalisation of `like`. */
function monthName(month: number, like: string): string {
  const pair = MONTHS[month]
  if (!pair) throw new RangeError(`No month ${month}`)
  const name = MONTHS.some(([ro]) => ro === like.toLowerCase())
    ? pair[0]
    : pair[1]
  if (like === like.toUpperCase()) return name.toUpperCase()
  if (like.charAt(0) === like.charAt(0).toUpperCase())
    return name.charAt(0).toUpperCase() + name.slice(1)
  return name
}

/**
 * A past broadcast's title with its date moved to `now`, in the same format:
 * "Serviciu divin 16.11.2025" → "Serviciu divin 23.11.2025", also for
 * 16/11/25, 2025-11-16 and "16 noiembrie 2025" / "16 November 2025".
 */
export function refreshTitleDate(title: string, now: Date): string {
  const day = now.getDate()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return title
    .replace(
      /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/,
      (_, _y, m, d) => `${year}-${sameWidth(month, m)}-${sameWidth(day, d)}`,
    )
    .replace(
      /\b(\d{1,2})([./-])(\d{1,2})\2(\d{4}|\d{2})\b/,
      (_, d, sep, m, y) =>
        `${sameWidth(day, d)}${sep}${sameWidth(month, m)}${sep}${sameWidth(year, y)}`,
    )
    .replace(
      new RegExp(`\\b(\\d{1,2})(\\s+)(${MONTH_NAMES})(\\s+)(\\d{4})\\b`, 'i'),
      (_, d, s1, name, s2) =>
        `${d.startsWith('0') ? sameWidth(day, d) : day}${s1}${monthName(month - 1, name)}${s2}${year}`,
    )
}
