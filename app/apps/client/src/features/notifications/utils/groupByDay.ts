import type { AppNotification } from '../service/notificationsApi'

const DAY_MS = 24 * 60 * 60 * 1000

const startOfDay = (time: number) => new Date(time).setHours(0, 0, 0, 0)

/**
 * Notifications (newest first) by the day they came, each day named:
 * "Today", "Yesterday", then its date.
 */
export function groupByDay(
  notifications: AppNotification[],
  language: string,
  names: { today: string; yesterday: string },
): { label: string; items: AppNotification[] }[] {
  const today = startOfDay(Date.now())
  const dayName = (day: number) => {
    if (day === today) return names.today
    if (day === startOfDay(today - DAY_MS / 2)) return names.yesterday
    return new Date(day).toLocaleDateString(language, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }
  const days: { label: string; items: AppNotification[] }[] = []
  let current: number | null = null
  for (const notification of notifications) {
    const day = startOfDay(notification.createdAt)
    if (day !== current) {
      days.push({ label: dayName(day), items: [] })
      current = day
    }
    days[days.length - 1]?.items.push(notification)
  }
  return days
}
