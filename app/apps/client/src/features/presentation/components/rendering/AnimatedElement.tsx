import { type ReactNode, useEffect, useRef, useState } from 'react'

import { useAnimationContext } from './AnimationContext'
import type { AnimationConfig } from '../../types'

interface AnimatedElementProps {
  children: ReactNode
  animationIn?: AnimationConfig
  animationOut?: AnimationConfig
  slideTransitionIn?: AnimationConfig // Animation for new content entering during slide change
  slideTransitionOut?: AnimationConfig // Animation for old content leaving during slide change
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
  slideTransitionIn,
  slideTransitionOut,
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
    isSlideTransitionExitPhase,
    slideTransitionExitFrame,
  } = useAnimationContext()
  const [shouldRender, setShouldRender] = useState(isVisible)
  const [phase, setPhase] = useState<AnimationPhase>(
    isVisible ? 'idle' : 'idle',
  )
  // Track if we're in a slide transition exit (showing old content while fading out)
  const [isInSlideTransitionExit, setIsInSlideTransitionExit] = useState(false)
  const prevContentKeyRef = useRef(contentKey)
  const prevAnimationFrameRef = useRef(animationFrame)
  const prevExitFrameRef = useRef(exitFrame)
  const prevSlideTransitionExitFrameRef = useRef(slideTransitionExitFrame)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Cache children when visible so we can animate them out even if parent stops providing them
  const cachedChildrenRef = useRef<ReactNode>(children)

  // Update cached children when visible and children are provided
  // But DON'T update during slide transition exit (we want to show old content while fading out)
  // Check both local state and context to handle timing correctly
  // CRITICAL: Also check that contentKey hasn't changed - when contentKey changes,
  // React renders with NEW children before the context effect runs. By checking
  // contentKey === prevContentKeyRef.current, we ensure we keep the OLD cached children
  // during that first render, so the exit animation shows OLD content fading out.
  if (
    isVisible &&
    children &&
    !isInSlideTransitionExit &&
    !isSlideTransitionExitPhase &&
    (contentKey === undefined || contentKey === prevContentKeyRef.current)
  ) {
    cachedChildrenRef.current = children
  }

  // Handle slide transition exit animations (fade out old content before new content appears)
  // NOTE: We do NOT use a timeout here. The element stays in 'exiting' phase (showing old content)
  // until the AnimationContext signals to start entering (via animationFrame change).
  // This eliminates the gap between exit and enter that was causing flickering.
  useEffect(() => {
    const slideTransitionExitFrameChanged =
      prevSlideTransitionExitFrameRef.current !== slideTransitionExitFrame

    if (isSlideTransitionExitPhase && slideTransitionExitFrameChanged) {
      // Start slide transition exit - fade out old content using slideTransitionOut config
      setIsInSlideTransitionExit(true)
      setPhase('exiting')
      // Element stays in 'exiting' phase until context triggers enter via animationFrame
    }

    // When exit phase ends (context is ready for enter), clean up
    if (
      !isSlideTransitionExitPhase &&
      prevSlideTransitionExitFrameRef.current !== 0
    ) {
      setIsInSlideTransitionExit(false)
    }

    prevSlideTransitionExitFrameRef.current = slideTransitionExitFrame
  }, [isSlideTransitionExitPhase, slideTransitionExitFrame])

  // Handle synchronized exit animations via context (for when content becomes hidden)
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

    // Enter animation is ONLY triggered by animationFrameChanged.
    // The context controls when animationFrame increments:
    // - For initial visibility: immediately when isVisible becomes true
    // - For slide transitions: AFTER exit animation + delay completes
    // This ensures proper sequencing: fade out → delay → fade in
    const shouldTriggerEnter = isVisible && animationFrameChanged

    if (shouldTriggerEnter) {
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
    const isExiting = phase === 'exiting'
    // Use separate slideTransitionIn/Out for content changes (navigating between slides)
    // Use animationIn for initial visibility, animationOut for exit
    let currentAnimation: AnimationConfig | undefined
    if (isEntering) {
      // Use slideTransitionIn for enter when it's a slide transition
      currentAnimation =
        isSlideTransition && slideTransitionIn ? slideTransitionIn : animationIn
    } else if (isExiting && isInSlideTransitionExit) {
      // Use slideTransitionOut for exit during slide transitions (not animationOut)
      currentAnimation = slideTransitionOut
    } else {
      // Use animationOut for normal exit (when content becomes hidden)
      currentAnimation = animationOut
    }
    // Default to 'fade' animation if not configured (ensures all elements animate together)
    const animationType = currentAnimation?.type ?? 'fade'

    // If animation is 'none', keep element fully visible (no opacity changes)
    if (animationType === 'none') {
      return { opacity: 1 }
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

  // Detect if content just changed (before effects have run to start exit animation)
  // This happens on the first render after contentKey changes - phase is still 'idle'
  // but we need to show OLD content while the exit animation sets up
  const contentJustChanged =
    contentKey !== undefined && contentKey !== prevContentKeyRef.current

  // Use cached children during exit animation, OR when content just changed
  // (before effects have run to start the exit animation).
  // This prevents a flash of new content before the old content fades out.
  const displayChildren =
    phase === 'exiting' || (contentJustChanged && phase === 'idle')
      ? (cachedChildrenRef.current ?? children)
      : children

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
