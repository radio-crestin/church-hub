const UNITS = ['B', 'KB', 'MB', 'GB'] as const
const STEP = 1024

/**
 * A file size for people: "512 B", "3.5 MB" — or "3,5 MB" in Romanian, since
 * the number follows the locale's decimal separator. Binary steps (1024), the
 * same the upload limits are expressed in.
 */
export function formatFileSize(bytes: number, locale: string): string {
  let value = Math.max(bytes, 0)
  let unitIndex = 0
  while (value >= STEP && unitIndex < UNITS.length - 1) {
    value /= STEP
    unitIndex++
  }
  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  }).format(value)
  return `${number} ${UNITS[unitIndex]}`
}
