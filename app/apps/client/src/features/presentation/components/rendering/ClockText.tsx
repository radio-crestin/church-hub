import { useEffect, useState } from 'react'

import { AnimatedText } from './AnimatedText'
import type { AnimationConfig, TextStyle } from '../../types'

interface ClockTextProps {
  /** Whether to show seconds in the time display */
  showSeconds?: boolean
  /** Text styling */
  style: TextStyle
  /** Container width in pixels */
  width: number
  /** Container height in pixels */
  height: number
  /** Position left in pixels */
  left: number
  /** Position top in pixels */
  top: number
  /** Animation for when content first appears */
  animationIn?: AnimationConfig
  /** Animation for when content disappears */
  animationOut?: AnimationConfig
  /** Animation for old content exiting during slide transitions */
  slideTransitionOut?: AnimationConfig
  /** Animation for new content entering during slide transitions */
  slideTransitionIn?: AnimationConfig
}

/**
 * Clock component that updates every second.
 * Uses its own state to ensure reliable updates.
 */
export function ClockText({
  showSeconds = false,
  style,
  width,
  height,
  left,
  top,
  animationIn = { type: 'none' },
  animationOut = { type: 'none' },
  slideTransitionIn = { type: 'none' },
  slideTransitionOut = { type: 'none' },
}: ClockTextProps) {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const timeString = showSeconds
    ? time.toLocaleTimeString('ro-RO', { hour12: false })
    : time.toLocaleTimeString('ro-RO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })

  return (
    <AnimatedText
      key="clock"
      content={timeString}
      contentKey="clock"
      isVisible={true}
      style={style}
      width={width}
      height={height}
      left={left}
      top={top}
      isHtml={false}
      animationIn={animationIn}
      animationOut={animationOut}
      slideTransitionIn={slideTransitionIn}
      slideTransitionOut={slideTransitionOut}
    />
  )
}
