import { type ReactNode, useEffect, useRef, useState } from 'react'

import type { AnimationConfig } from '../../types'

interface AnimatedElementProps {
  children: ReactNode
  animationIn?: AnimationConfig
  animationOut?: AnimationConfig
  isVisible: boolean
  contentKey?: string // Unique key that changes when content changes (triggers re-animation)
  className?: string
  style?: React.CSSProperties
}

const EASING_FUNCTIONS: Record<string, string> = {
  linear: 'linear',
  ease: 'ease',
  'ease-in': 'ease-in',
  'ease-out': 'ease-out',
  'ease-in-out': 'ease-in-out',
  // Legacy support for camelCase
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
}

// Animation phases:
// - idle: fully visible, no animation
// - entering-start: initial hidden state before animation
// - entering: animating to visible
// - exiting: animating to hidden (only when hiding presentation, NOT on slide changes)
type AnimationPhase = 'idle' | 'entering-start' | 'entering' | 'exiting'

export function AnimatedElement({
  children,
  animationIn,
  animationOut,
  isVisible,
  contentKey,
  className = '',
  style = {},
}: AnimatedElementProps) {
  const [shouldRender, setShouldRender] = useState(isVisible)
  const [phase, setPhase] = useState<AnimationPhase>(
    isVisible ? 'idle' : 'idle',
  )
  const prevContentKeyRef = useRef(contentKey)
  const prevVisibleRef = useRef(isVisible)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  // Cache children when visible so we can animate them out even if parent stops providing them
  const cachedChildrenRef = useRef<ReactNode>(children)

  // Update cached children when visible and children are provided
  if (isVisible && children) {
    cachedChildrenRef.current = children
  }

  // Handle visibility and content changes
  useEffect(() => {
    const contentChanged =
      contentKey !== undefined && prevContentKeyRef.current !== contentKey
    const becomingVisible = isVisible && !prevVisibleRef.current
    const becomingHidden = !isVisible && prevVisibleRef.current

    // Clear any pending animations
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    if (becomingVisible || (isVisible && contentChanged)) {
      // Case 1: Becoming visible (show presentation)
      // Case 2: Content changed while visible (next slide)
      // Both cases: animate IN the new content (no exit animation)
      setShouldRender(true)
      // Start from hidden state, then animate to visible
      setPhase('entering-start')
      // Use double RAF to ensure browser paints the start state first
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          setPhase('entering')
        })
      })
    } else if (becomingHidden) {
      // Case 3: Hiding presentation (ESC pressed, etc.)
      // Animate OUT using cached children, then stop rendering
      setPhase('exiting')
      const duration = animationOut?.duration ?? 300
      const delay = animationOut?.delay ?? 0
      timeoutRef.current = setTimeout(() => {
        setShouldRender(false)
        setPhase('idle')
        // Clear cached children after exit animation completes
        cachedChildrenRef.current = null
      }, duration + delay)
    }

    prevVisibleRef.current = isVisible
    prevContentKeyRef.current = contentKey
  }, [isVisible, contentKey, animationOut?.duration, animationOut?.delay])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  if (!shouldRender) {
    return null
  }

  const getAnimationStyles = (): React.CSSProperties => {
    // Determine which animation config to use
    const isEntering = phase === 'entering-start' || phase === 'entering'
    const currentAnimation = isEntering ? animationIn : animationOut
    const animationType = currentAnimation?.type ?? 'none'

    // No animation configured
    if (animationType === 'none') {
      return { opacity: phase === 'exiting' ? 0 : 1 }
    }

    const duration = currentAnimation?.duration ?? 300
    const delay = currentAnimation?.delay ?? 0
    const easing = currentAnimation?.easing ?? 'ease-out'
    const easingFunc = EASING_FUNCTIONS[easing] ?? 'ease-out'

    // Build start and end styles based on animation type
    const getTransformStyles = () => {
      switch (animationType) {
        case 'fade':
          return { start: { opacity: 0 }, end: { opacity: 1 } }
        case 'slide-up':
          return {
            start: { opacity: 0, transform: 'translateY(30px)' },
            end: { opacity: 1, transform: 'translateY(0)' },
          }
        case 'slide-down':
          return {
            start: { opacity: 0, transform: 'translateY(-30px)' },
            end: { opacity: 1, transform: 'translateY(0)' },
          }
        case 'slide-left':
          return {
            start: { opacity: 0, transform: 'translateX(30px)' },
            end: { opacity: 1, transform: 'translateX(0)' },
          }
        case 'slide-right':
          return {
            start: { opacity: 0, transform: 'translateX(-30px)' },
            end: { opacity: 1, transform: 'translateX(0)' },
          }
        case 'zoom':
          return {
            start: { opacity: 0, transform: 'scale(0.8)' },
            end: { opacity: 1, transform: 'scale(1)' },
          }
        case 'blur':
          return {
            start: { opacity: 0, filter: 'blur(10px)' },
            end: { opacity: 1, filter: 'blur(0px)' },
          }
        default:
          return { start: { opacity: 0 }, end: { opacity: 1 } }
      }
    }

    const { start, end } = getTransformStyles()

    // Determine current styles based on phase
    switch (phase) {
      case 'entering-start':
        // Initial state - no transition yet
        return start
      case 'entering':
        // Animate to visible state
        return {
          ...end,
          transition: `all ${duration}ms ${easingFunc} ${delay}ms`,
        }
      case 'exiting':
        // Animate to hidden state
        return {
          ...start,
          transition: `all ${duration}ms ${easingFunc} ${delay}ms`,
        }
      default:
        // Idle - fully visible
        return end
    }
  }

  // Use cached children during exit animation, otherwise use current children
  const displayChildren =
    phase === 'exiting' ? cachedChildrenRef.current : children

  return (
    <div
      className={className}
      style={{
        ...style,
        ...getAnimationStyles(),
        willChange: phase !== 'idle' ? 'opacity, transform, filter' : 'auto',
      }}
    >
      {displayChildren}
    </div>
  )
}
