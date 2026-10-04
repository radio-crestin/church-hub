/**
 * Today's date the way churches name their Sunday programs: "04.10.2026".
 */
export function todayProgramTitle(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}.${month}.${date.getFullYear()}`
}
