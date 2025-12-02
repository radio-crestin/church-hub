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
      hour12: false,
    })
  }

  return (
    <div
      className="absolute top-6 right-6"
      style={{ color: textColor, fontFamily }}
    >
      <div className="text-4xl font-medium">{formatTime(time)}</div>
    </div>
  )
}
