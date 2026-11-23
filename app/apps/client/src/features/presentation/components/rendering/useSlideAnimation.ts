import { useCallback, useEffect, useRef, useState } from 'react'

import type { AnimationType } from '../../types'
import { FACTORY_TRANSITIONS } from '../../utils/factoryTransitions'

export interface SlideAnimationConfig {
  type?: AnimationType
  duration?: number
  /** CSS timing function, e.g. 'ease-in-out' */
  easing?: string
}

interface UseSlideAnimationOptions<T> {
  /** Current content to display */
  content: T
  /** Unique key that changes when content changes */
  contentKey: string
  /** Whether the element should be visible */
  isVisible: boolean
  /** Animation for when content first appears (presentation starts) */
  animationIn?: SlideAnimationConfig
  /** Animation for when content disappears (presentation ends) */
  animationOut?: SlideAnimationConfig
  /** Animation for old content exiting during slide transitions */
  slideTransitionOut?: SlideAnimationConfig
  /** Animation for new content entering during slide transitions */
  slideTransitionIn?: SlideAnimationConfig
}

/** One copy of the element on screen: the current slide, or the one leaving. */
export interface SlideLayer<T> {
  /** Stable for the layer's life, so its DOM (and fitted text) survives as it leaves */
  id: number
  content: T
  /** CSS styles for the layer's animation phase */
  style: React.CSSProperties
  /** The previous slide, fading out under the new one */
  leaving: boolean
}

interface LeavingLayer<T> {
  id: number
  content: T
  config: SlideAnimationConfig
}

const DEFAULT_ANIMATION_DURATION = FACTORY_TRANSITIONS.animationIn.duration
const DEFAULT_SLIDE_TRANSITION_DURATION =
  FACTORY_TRANSITIONS.slideTransitionOut.duration

/** The CSS transition for one animation, with its own duration and easing. */
function toCssTransition(config: SlideAnimationConfig): string {
  const duration = config.duration ?? DEFAULT_ANIMATION_DURATION
  return `all ${duration}ms ${config.easing ?? 'ease-out'}`
}

/**
 * Animation phases:
 * - 'hidden': Element not rendered
 * - 'mounting': Element rendered with START styles, waiting for next frame
 * - 'entering': Transitioning from START to END styles
 * - 'visible': Fully visible, idle state
 * - 'exiting': Transitioning from END to START styles (presentation hidden)
 *
 * A slide change crossfades: the old slide becomes a leaving layer that plays
 * its exit while the new one enters at once, so the new slide starts showing
 * right away and there is never a blank gap between slides.
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
 * 3. Slide changes (contentChanged while visible): the old slide leaves with
 *    slideTransitionOut while the new one enters with slideTransitionIn
 *
 * The key insight is that CSS transitions don't work on initial mount -
 * there's no previous state to transition from. We solve this by:
 * 1. First render: Apply START styles (opacity: 0, etc.)
 * 2. Next frame: Apply END styles with transition
 */
export function useSlideAnimation<T>({
  content,
  contentKey,
  isVisible,
  animationIn,
  animationOut,
  slideTransitionOut,
  slideTransitionIn,
}: UseSlideAnimationOptions<T>): SlideLayer<T>[] {
  // Cache content for exit animations (show old content while animating out)
  const cachedContentRef = useRef<T>(content)
  const cachedKeyRef = useRef(contentKey)
  const layerIdRef = useRef(0)
  const [leaving, setLeaving] = useState<LeavingLayer<T> | null>(null)

  // Track previous visibility state. An element starts out hidden, so one that
  // mounts already visible (the first slide after an empty screen, or a new
  // content type's text) fades in with animationIn instead of cutting in.
  const prevVisibleRef = useRef(false)
  const prevContentKeyRef = useRef(contentKey)
  const hasAnimatedIn = useRef(false)

  const [phase, setPhase] = useState<AnimationPhase>('hidden')

  // Track which animation config to use for current transition
  const [currentEnterConfig, setCurrentEnterConfig] =
    useState<SlideAnimationConfig | null>(null)
  const [currentExitConfig, setCurrentExitConfig] =
    useState<SlideAnimationConfig | null>(null)

  // Refs for timeouts and animation frames
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leavingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)

  // Get animation configs with fallbacks
  const getEnterAnimation = useCallback(
    (isSlideChange: boolean): SlideAnimationConfig => {
      if (isSlideChange) {
        return slideTransitionIn ?? FACTORY_TRANSITIONS.slideTransitionIn
      }
      return animationIn ?? FACTORY_TRANSITIONS.animationIn
    },
    [animationIn, slideTransitionIn],
  )

  const getExitAnimation = useCallback(
    (isSlideChange: boolean): SlideAnimationConfig => {
      if (isSlideChange) {
        return slideTransitionOut ?? FACTORY_TRANSITIONS.slideTransitionOut
      }
      return animationOut ?? FACTORY_TRANSITIONS.animationOut
    },
    [animationOut, slideTransitionOut],
  )

  // Clear pending timers
  const clearTimers = useCallback(() => {
    if (leavingTimeoutRef.current) {
      clearTimeout(leavingTimeoutRef.current)
      leavingTimeoutRef.current = null
    }
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
  const startEnterAnimation = useCallback(
    (enterConfig: SlideAnimationConfig) => {
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
    },
    [],
  )

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

    if (becameVisible || becameHidden) setLeaving(null)

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
      // Slide change - crossfade: the old content leaves on its own layer
      // while the new content enters at once
      const exitConfig = getExitAnimation(true)
      const enterConfig = getEnterAnimation(true)
      const exitType = exitConfig.type ?? 'fade'
      const exitDuration =
        exitConfig.duration ?? DEFAULT_SLIDE_TRANSITION_DURATION

      if (exitType === 'none') {
        setLeaving(null)
      } else {
        setLeaving({
          id: layerIdRef.current,
          content: cachedContentRef.current,
          config: exitConfig,
        })
        leavingTimeoutRef.current = setTimeout(
          () => setLeaving(null),
          exitDuration,
        )
      }
      layerIdRef.current++
      cachedContentRef.current = content
      cachedKeyRef.current = contentKey
      startEnterAnimation(enterConfig)
    } else if (isVisible && cachedKeyRef.current === contentKey) {
      // Content updated without key change (e.g., clock, highlights) - just
      // update cached content, so a slide that leaves takes its latest look
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

  // Detect if we're about to become visible (isVisible=true but phase=hidden)
  // This happens on the first render after isVisible changes from false to true,
  // before the effect has a chance to update the phase state.
  const isBecomingVisible = isVisible && phase === 'hidden'

  // Generate CSS styles based on current phase
  const getStyle = (): React.CSSProperties => {
    // Use the stored configs for current animation
    const enterConfig = currentEnterConfig ?? getEnterAnimation(false)
    const exitConfig = currentExitConfig ?? getExitAnimation(false)

    const enterStyles = getAnimationStyles(enterConfig.type ?? 'fade')
    const exitStyles = getAnimationStyles(exitConfig.type ?? 'fade')
    const enterTransition = toCssTransition(enterConfig)
    const exitTransition = toCssTransition(exitConfig)

    // Special case: becoming visible but effect hasn't run yet
    // Render with START styles so element is ready for animation
    if (isBecomingVisible) {
      return { ...enterStyles.start, transition: enterTransition }
    }

    switch (phase) {
      case 'hidden':
        return { opacity: 0 }

      case 'mounting':
        // Initial render - apply START styles WITH transition
        // The transition is pre-applied so it's ready when entering phase starts
        return { ...enterStyles.start, transition: enterTransition }

      case 'entering':
        // Transitioning to END styles - transition was already set in mounting
        return { ...enterStyles.end, transition: enterTransition }

      case 'visible':
        // Fully visible - END styles without transition
        return enterStyles.end

      case 'exiting':
        // Transitioning to START styles
        return { ...exitStyles.start, transition: exitTransition }

      default:
        return { opacity: 1 }
    }
  }

  // Should we render the element?
  // Also render if we're becoming visible (before effect updates phase)
  const shouldRender = phase !== 'hidden' || isBecomingVisible

  // The current content is shown live, so edits and highlights apply at once.
  // The cached content is shown while it exits (presentation hidden), and on
  // the render where the key has changed but the effect hasn't run yet, so the
  // new slide never flashes in at full opacity before its crossfade starts.
  const showsLiveContent =
    isBecomingVisible ||
    (phase !== 'exiting' && cachedKeyRef.current === contentKey)

  const layers: SlideLayer<T>[] = []
  if (leaving) {
    const leavingStyles = getAnimationStyles(leaving.config.type ?? 'fade')
    layers.push({
      id: leaving.id,
      content: leaving.content,
      style: {
        ...leavingStyles.start,
        transition: toCssTransition(leaving.config),
      },
      leaving: true,
    })
  }
  if (shouldRender) {
    layers.push({
      id: layerIdRef.current,
      content: showsLiveContent ? content : cachedContentRef.current,
      style: getStyle(),
      leaving: false,
    })
  }
  return layers
}
