import { useEffect, useState } from 'react'

interface ClockOverlayProps {
  textColor?: string
  fontFamily?: string
}

export function ClockOverlay({
  textColor = '#ffffff',
  fontFamily = 'system-ui',
}: ClockOverlayProps) {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    let isActive = true

    const tick = () => {
      if (!isActive) return

      const now = new Date()
      setTime(now)

      // Calculate ms until the next second boundary to prevent drift
      const msUntilNextSecond = 1000 - now.getMilliseconds()
      timeoutId = setTimeout(tick, msUntilNextSecond)
    }

    // Start with immediate update, then sync to second boundary
    const now = new Date()
    setTime(now)
    const msUntilNextSecond = 1000 - now.getMilliseconds()
    timeoutId = setTimeout(tick, msUntilNextSecond)

    return () => {
      isActive = false
      clearTimeout(timeoutId)
    }
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
