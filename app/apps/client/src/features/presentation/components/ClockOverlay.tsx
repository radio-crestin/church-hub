import { useEffect, useState } from 'react'

interface ClockOverlayProps {
  textColor?: string
  fontFamily?: string
}

export function ClockOverlay({
  textColor = '#ffffff',
  fontFamily = 'system-ui',
}: ClockOverlayProps) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div
      className="flex flex-col items-center justify-center h-full w-full"
      style={{ color: textColor, fontFamily }}
    >
      <div className="text-8xl font-bold mb-4">{formatTime(time)}</div>
      <div className="text-3xl opacity-80">{formatDate(time)}</div>
    </div>
  )
}
