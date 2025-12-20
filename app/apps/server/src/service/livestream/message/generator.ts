const DAY_NAMES_RO: Record<string, string> = {
  Monday: 'Luni',
  Tuesday: 'Marti',
  Wednesday: 'Miercuri',
  Thursday: 'Joi',
  Friday: 'Vineri',
  Saturday: 'Sambata',
  Sunday: 'Duminica',
}

const SUNDAY_MORNING_CUTOFF = '12:00:00'

export function generateBroadcastMessage(broadcastUrl?: string): string {
  const now = new Date()

  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })
  const currentTime = now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const dateFormatted = now.toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  let message: string

  if (dayName === 'Sunday') {
    if (currentTime < SUNDAY_MORNING_CUTOFF) {
      message = 'Duminica dimineata'
    } else {
      message = 'Duminica seara'
    }
  } else {
    message = DAY_NAMES_RO[dayName] || dayName
  }

  message = `${message} ${dateFormatted}`

  if (broadcastUrl) {
    message = `${message}\n${broadcastUrl}`
  }

  return message
}
