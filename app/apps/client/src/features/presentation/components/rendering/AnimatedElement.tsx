import { type ReactNode, useEffect, useRef, useState } from 'react'

import { useAnimationContext } from './AnimationContext'
import type { AnimationConfig } from '../../types'

interface AnimatedElementProps {
  children: ReactNode
  animationIn?: AnimationConfig
  animationOut?: AnimationConfig
  slideTransition?: AnimationConfig // Animation used when transitioning between slides
  isVisible: boolean
  contentKey?: string // Used to detect content changes for this specific element
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
// - entering-start: initial hidden state before animation (synchronized via context)
// - entering: animating to visible
// - exiting: animating to hidden (synchronized via context)
type AnimationPhase = 'idle' | 'entering-start' | 'entering' | 'exiting'

export function AnimatedElement({
  children,
  animationIn,
  animationOut,
  slideTransition,
  isVisible,
  contentKey,
  className = '',
  style = {},
}: AnimatedElementProps) {
  const {
    animationFrame,
    isStartPhase,
    isExitPhase,
    exitFrame,
    isSlideTransition,
  } = useAnimationContext()
  const [shouldRender, setShouldRender] = useState(isVisible)
  const [phase, setPhase] = useState<AnimationPhase>(
    isVisible ? 'idle' : 'idle',
  )
  const prevContentKeyRef = useRef(contentKey)
  const prevAnimationFrameRef = useRef(animationFrame)
  const prevExitFrameRef = useRef(exitFrame)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Cache children when visible so we can animate them out even if parent stops providing them
  const cachedChildrenRef = useRef<ReactNode>(children)

  // Update cached children when visible and children are provided
  if (isVisible && children) {
    cachedChildrenRef.current = children
  }

  // Handle synchronized exit animations via context
  useEffect(() => {
    const exitFrameChanged = prevExitFrameRef.current !== exitFrame

    // Clear any pending timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (isExitPhase && exitFrameChanged) {
      // Context signaled to start exit animation - all elements exit together
      setPhase('exiting')
      const duration = animationOut?.duration ?? 200
      const delay = animationOut?.delay ?? 0
      timeoutRef.current = setTimeout(() => {
        setShouldRender(false)
        setPhase('idle')
        cachedChildrenRef.current = null
      }, duration + delay)
    }

    prevExitFrameRef.current = exitFrame
  }, [isExitPhase, exitFrame, animationOut?.duration, animationOut?.delay])

  // Handle synchronized enter animations via context
  // This effect responds to the shared animationFrame changes
  useEffect(() => {
    const animationFrameChanged =
      prevAnimationFrameRef.current !== animationFrame
    const contentChanged =
      contentKey !== undefined && prevContentKeyRef.current !== contentKey

    if (isVisible && (animationFrameChanged || contentChanged)) {
      // New animation cycle started - ensure we're rendering
      setShouldRender(true)

      // Set phase based on shared context
      if (isStartPhase) {
        setPhase('entering-start')
      } else {
        setPhase('entering')
      }
    }

    prevAnimationFrameRef.current = animationFrame
    prevContentKeyRef.current = contentKey
  }, [animationFrame, isStartPhase, isVisible, contentKey])

  // Respond to isStartPhase changes from context (synchronized animation trigger)
  useEffect(() => {
    if (isVisible && phase === 'entering-start' && !isStartPhase) {
      // Context signaled to start animation - all elements transition together
      setPhase('entering')
    }
  }, [isStartPhase, isVisible, phase])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  if (!shouldRender) {
    return null
  }

  const getAnimationStyles = (): React.CSSProperties => {
    // Determine which animation config to use
    const isEntering = phase === 'entering-start' || phase === 'entering'
    // Use slideTransition for content changes (navigating between slides)
    // Use animationIn for initial visibility, animationOut for exit
    let currentAnimation: AnimationConfig | undefined
    if (isEntering) {
      currentAnimation =
        isSlideTransition && slideTransition ? slideTransition : animationIn
    } else {
      currentAnimation = animationOut
    }
    // Default to 'fade' animation if not configured (ensures all elements animate together)
    const animationType = currentAnimation?.type ?? 'fade'

    // Only skip animation if explicitly set to 'none'
    if (animationType === 'none') {
      return { opacity: phase === 'exiting' ? 0 : 1 }
    }

    // Use consistent default durations for synchronization
    const defaultDuration = isEntering ? 300 : 200
    const duration = currentAnimation?.duration ?? defaultDuration
    // Force delay to 0 for all animations to ensure synchronization
    const delay = 0
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
