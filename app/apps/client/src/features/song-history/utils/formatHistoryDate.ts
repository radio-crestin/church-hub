/** "Oct 5, 2026, 9:30 AM" in the app language; `createdAt` is Unix seconds. */
export function formatHistoryDate(createdAt: number, language: string): string {
  return new Date(createdAt * 1000).toLocaleString(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
