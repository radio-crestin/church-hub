import { useCallback, useEffect, useRef, useState } from 'react'

export type AnimationType =
  | 'none'
  | 'fade'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'zoom'
  | 'blur'

export interface AnimationConfig {
  type?: AnimationType
  duration?: number
}

interface UseSlideAnimationOptions {
  /** Current content to display */
  content: React.ReactNode
  /** Unique key that changes when content changes */
  contentKey: string
  /** Whether the element should be visible */
  isVisible: boolean
  /** Animation for when content first appears (presentation starts) */
  animationIn?: AnimationConfig
  /** Animation for when content disappears (presentation ends) */
  animationOut?: AnimationConfig
  /** Animation for old content exiting during slide transitions */
  slideTransitionOut?: AnimationConfig
  /** Animation for new content entering during slide transitions */
  slideTransitionIn?: AnimationConfig
}

interface SlideAnimationState {
  /** The content to actually render (may be cached old content during exit) */
  displayContent: React.ReactNode
  /** CSS styles to apply for current animation phase */
  style: React.CSSProperties
  /** Whether the element should render at all */
  shouldRender: boolean
}

const DEFAULT_ANIMATION_DURATION = 300
const DEFAULT_SLIDE_TRANSITION_DURATION = 250

/**
 * Animation phases:
 * - 'hidden': Element not rendered
 * - 'mounting': Element rendered with START styles, waiting for next frame
 * - 'entering': Transitioning from START to END styles
 * - 'visible': Fully visible, idle state
 * - 'exiting': Transitioning from END to START styles
 */
type AnimationPhase = 'hidden' | 'mounting' | 'entering' | 'visible' | 'exiting'

/**
 * Get CSS styles for animation start and end states
 */
function getAnimationStyles(animType: AnimationType): {
  start: React.CSSProperties
  end: React.CSSProperties
} {
  switch (animType) {
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
        start: { opacity: 0, transform: 'scale(0.85)' },
        end: { opacity: 1, transform: 'scale(1)' },
      }
    case 'blur':
      return {
        start: { opacity: 0, filter: 'blur(10px)' },
        end: { opacity: 1, filter: 'blur(0px)' },
      }
    case 'none':
    default:
      return { start: { opacity: 1 }, end: { opacity: 1 } }
  }
}

/**
 * Hook for slide transition animations.
 * Properly handles CSS transitions including on mount.
 *
 * Animation scenarios:
 * 1. Presentation starts (becameVisible): Use animationIn
 * 2. Presentation ends (becameHidden): Use animationOut
 * 3. Slide changes (contentChanged while visible): Use slideTransitionOut/In
 *
 * The key insight is that CSS transitions don't work on initial mount -
 * there's no previous state to transition from. We solve this by:
 * 1. First render: Apply START styles (opacity: 0, etc.)
 * 2. Next frame: Apply END styles with transition
 */
export function useSlideAnimation({
  content,
  contentKey,
  isVisible,
  animationIn,
  animationOut,
  slideTransitionOut,
  slideTransitionIn,
}: UseSlideAnimationOptions): SlideAnimationState {
  // Cache content for exit animations (show old content while animating out)
  const cachedContentRef = useRef<React.ReactNode>(content)
  const cachedKeyRef = useRef(contentKey)

  // Track previous visibility state
  const prevVisibleRef = useRef(isVisible)
  const prevContentKeyRef = useRef(contentKey)
  const hasAnimatedIn = useRef(false)

  // Animation phase state - start visible if already visible to avoid flash
  const [phase, setPhase] = useState<AnimationPhase>(
    isVisible ? 'visible' : 'hidden',
  )

  // Track which animation config to use for current transition
  const [currentEnterConfig, setCurrentEnterConfig] =
    useState<AnimationConfig | null>(null)
  const [currentExitConfig, setCurrentExitConfig] =
    useState<AnimationConfig | null>(null)

  // Refs for timeouts and animation frames
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)

  // Get animation configs with fallbacks
  const getEnterAnimation = useCallback(
    (isSlideChange: boolean): AnimationConfig => {
      if (isSlideChange) {
        return (
          slideTransitionIn ?? {
            type: 'fade',
            duration: DEFAULT_SLIDE_TRANSITION_DURATION,
          }
        )
      }
      return (
        animationIn ?? { type: 'fade', duration: DEFAULT_ANIMATION_DURATION }
      )
    },
    [animationIn, slideTransitionIn],
  )

  const getExitAnimation = useCallback(
    (isSlideChange: boolean): AnimationConfig => {
      if (isSlideChange) {
        return (
          slideTransitionOut ?? {
            type: 'fade',
            duration: DEFAULT_SLIDE_TRANSITION_DURATION,
          }
        )
      }
      return (
        animationOut ?? { type: 'fade', duration: DEFAULT_ANIMATION_DURATION }
      )
    },
    [animationOut, slideTransitionOut],
  )

  // Clear pending timers
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  // Start enter animation
  const startEnterAnimation = useCallback((enterConfig: AnimationConfig) => {
    setCurrentEnterConfig(enterConfig)
    const enterType = enterConfig.type ?? 'fade'
    const enterDuration = enterConfig.duration ?? DEFAULT_ANIMATION_DURATION

    if (enterType === 'none') {
      setPhase('visible')
    } else {
      setPhase('mounting')

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          setPhase('entering')
          timeoutRef.current = setTimeout(() => {
            setPhase('visible')
          }, enterDuration)
        })
      })
    }
  }, [])

  // Handle visibility and content changes
  useEffect(() => {
    const wasVisible = prevVisibleRef.current
    const becameVisible = isVisible && !wasVisible
    const becameHidden = !isVisible && wasVisible
    const contentChanged =
      isVisible && wasVisible && prevContentKeyRef.current !== contentKey

    // Update refs for next comparison
    prevVisibleRef.current = isVisible
    prevContentKeyRef.current = contentKey

    // Only clear timers if we're starting a new animation sequence
    // Don't clear if effect re-runs for unrelated reasons (e.g., content reference change)
    if (becameVisible || becameHidden || contentChanged) {
      clearTimers()
    }

    if (becameVisible) {
      // Presentation starting - update content and animate in
      cachedContentRef.current = content
      cachedKeyRef.current = contentKey

      if (!hasAnimatedIn.current) {
        hasAnimatedIn.current = true
        const enterConfig = getEnterAnimation(false)
        startEnterAnimation(enterConfig)
      } else {
        setPhase('visible')
      }
    } else if (becameHidden) {
      // Presentation ending - keep old content visible during exit animation
      hasAnimatedIn.current = false
      const exitConfig = getExitAnimation(false)
      setCurrentExitConfig(exitConfig)
      const exitType = exitConfig.type ?? 'fade'
      const exitDuration = exitConfig.duration ?? DEFAULT_ANIMATION_DURATION

      if (exitType === 'none') {
        setPhase('hidden')
      } else {
        setPhase('exiting')
        timeoutRef.current = setTimeout(() => {
          setPhase('hidden')
        }, exitDuration)
      }
    } else if (contentChanged) {
      // Slide change - keep OLD content during exit, then show NEW content
      const exitConfig = getExitAnimation(true)
      const enterConfig = getEnterAnimation(true)
      setCurrentExitConfig(exitConfig)

      const exitType = exitConfig.type ?? 'fade'
      const exitDuration =
        exitConfig.duration ?? DEFAULT_SLIDE_TRANSITION_DURATION
      const enterType = enterConfig.type ?? 'fade'

      if (exitType === 'none' && enterType === 'none') {
        // No animations - instant swap
        cachedContentRef.current = content
        cachedKeyRef.current = contentKey
        setPhase('visible')
      } else if (exitType === 'none') {
        // Skip exit, just update content and enter
        cachedContentRef.current = content
        cachedKeyRef.current = contentKey
        startEnterAnimation(enterConfig)
      } else {
        // Full exit then enter sequence
        // DON'T update content yet - keep showing old content during exit
        setPhase('exiting')

        timeoutRef.current = setTimeout(() => {
          // NOW update to new content after exit completes
          cachedContentRef.current = content
          cachedKeyRef.current = contentKey
          startEnterAnimation(enterConfig)
        }, exitDuration)
      }
    } else if (isVisible && phase === 'visible') {
      // Content updated without key change (e.g., clock) - just update cached content
      cachedContentRef.current = content
    }

    // Don't return clearTimers here - we only want to clear on unmount, not on every re-run
    // The clearTimers() call at the start handles clearing when starting new animations
    // Note: phase is intentionally NOT in deps - phase changes should not re-run this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    content,
    contentKey,
    isVisible,
    getEnterAnimation,
    getExitAnimation,
    clearTimers,
    startEnterAnimation,
  ])

  // Cleanup on unmount only
  useEffect(() => {
    return clearTimers
  }, [clearTimers])

  // Generate CSS styles based on current phase
  const getStyle = (): React.CSSProperties => {
    // Use the stored configs for current animation
    const enterConfig = currentEnterConfig ?? getEnterAnimation(false)
    const exitConfig = currentExitConfig ?? getExitAnimation(false)

    const enterType = enterConfig.type ?? 'fade'
    const enterDuration = enterConfig.duration ?? DEFAULT_ANIMATION_DURATION
    const exitType = exitConfig.type ?? 'fade'
    const exitDuration = exitConfig.duration ?? DEFAULT_ANIMATION_DURATION

    const enterStyles = getAnimationStyles(enterType)
    const exitStyles = getAnimationStyles(exitType)

    switch (phase) {
      case 'hidden':
        return { opacity: 0 }

      case 'mounting':
        // Initial render - apply START styles WITH transition
        // The transition is pre-applied so it's ready when entering phase starts
        return {
          ...enterStyles.start,
          transition: `all ${enterDuration}ms ease-out`,
        }

      case 'entering':
        // Transitioning to END styles - transition was already set in mounting
        return {
          ...enterStyles.end,
          transition: `all ${enterDuration}ms ease-out`,
        }

      case 'visible':
        // Fully visible - END styles without transition
        return enterStyles.end

      case 'exiting':
        // Transitioning to START styles
        return {
          ...exitStyles.start,
          transition: `all ${exitDuration}ms ease-out`,
        }

      default:
        return { opacity: 1 }
    }
  }

  // Should we render the element?
  const shouldRender = phase !== 'hidden'

  return {
    displayContent: cachedContentRef.current,
    style: getStyle(),
    shouldRender,
  }
}
