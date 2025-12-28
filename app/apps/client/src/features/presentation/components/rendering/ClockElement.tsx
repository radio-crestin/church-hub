import { useEffect, useState } from 'react'

import { calculateConstraintStyles, getTextStyleCSS } from './utils/styleUtils'
import type { ClockConfig, SizeWithUnits } from '../../types'

interface ClockElementProps {
  config: ClockConfig
  screenWidth: number
  screenHeight: number
}

export function ClockElement({
  config,
  screenWidth,
  screenHeight,
}: ClockElementProps) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Default size for backwards compatibility
  const clockSize: SizeWithUnits = config.size ?? {
    width: 10,
    widthUnit: '%',
    height: 5,
    heightUnit: '%',
  }

  const constraintStyles = calculateConstraintStyles(
    config.constraints,
    clockSize,
    screenWidth,
    screenHeight,
  )

  const formatTime = (date: Date): string => {
    if (config.format === '12h') {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: config.showSeconds ? '2-digit' : undefined,
        hour12: true,
      })
    }
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: config.showSeconds ? '2-digit' : undefined,
      hour12: false,
    })
  }

  const styles: React.CSSProperties = {
    ...constraintStyles,
    display: 'flex',
    alignItems:
      config.style.verticalAlignment === 'top'
        ? 'flex-start'
        : config.style.verticalAlignment === 'bottom'
          ? 'flex-end'
          : 'center',
    justifyContent:
      config.style.alignment === 'center'
        ? 'center'
        : config.style.alignment === 'right'
          ? 'flex-end'
          : 'flex-start',
    ...getTextStyleCSS(config.style),
    fontSize: config.style.maxFontSize,
  }

  return <div style={styles}>{formatTime(time)}</div>
}
