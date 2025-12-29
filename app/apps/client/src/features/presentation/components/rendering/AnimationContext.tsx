import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

interface AnimationContextValue {
  // Shared animation frame ID - increments when all elements should start animating
  animationFrame: number
  // Whether we're in the "start" phase (before enter animation begins)
  isStartPhase: boolean
  // Whether we're in the exit phase (all elements should exit together)
  isExitPhase: boolean
  // Exit frame ID - increments when all elements should start exiting
  exitFrame: number
  // Whether this is a slide transition (content change while visible) vs initial visibility
  isSlideTransition: boolean
  // Whether we're in the exit phase of a slide transition (old content fading out)
  isSlideTransitionExitPhase: boolean
  // Slide transition exit frame ID - increments when old content should start exiting
  slideTransitionExitFrame: number
  // Duration for slide transition OUT (old content leaving)
  slideTransitionOutDuration: number
  // Duration for slide transition IN (new content entering)
  slideTransitionInDuration: number
}

const AnimationContext = createContext<AnimationContextValue>({
  animationFrame: 0,
  isStartPhase: false,
  isExitPhase: false,
  exitFrame: 0,
  isSlideTransition: false,
  isSlideTransitionExitPhase: false,
  slideTransitionExitFrame: 0,
  slideTransitionOutDuration: 250,
  slideTransitionInDuration: 250,
})

interface AnimationProviderProps {
  children: ReactNode
  // Key that triggers animation reset when changed
  contentKey: string
  // Whether content is visible
  isVisible: boolean
  // Duration for slide transition OUT animation (old content leaving)
  slideTransitionOutDuration?: number
  // Duration for slide transition IN animation (new content entering)
  slideTransitionInDuration?: number
}

/**
 * Provides synchronized animation timing to all child AnimatedElements.
 * When contentKey changes, all elements start their animation in the same frame.
 * When isVisible becomes false, all elements start their exit animation together.
 *
 * For slide transitions (content changes while visible), implements a two-phase animation:
 * 1. Exit phase: Old content animates out using slideTransitionOut config
 * 2. Wait for exit to fully complete
 * 3. Enter phase: New content animates in using slideTransitionIn config
 */
export function AnimationProvider({
  children,
  contentKey,
  isVisible,
  slideTransitionOutDuration = 250,
  slideTransitionInDuration = 250,
}: AnimationProviderProps) {
  const [animationFrame, setAnimationFrame] = useState(0)
  const [isStartPhase, setIsStartPhase] = useState(false)
  const [isExitPhase, setIsExitPhase] = useState(false)
  const [exitFrame, setExitFrame] = useState(0)
  const [isSlideTransition, setIsSlideTransition] = useState(false)
  const [isSlideTransitionExitPhase, setIsSlideTransitionExitPhase] =
    useState(false)
  const [slideTransitionExitFrame, setSlideTransitionExitFrame] = useState(0)

  const prevContentKeyRef = useRef(contentKey)
  const prevVisibleRef = useRef(isVisible)
  const rafRef = useRef<number | null>(null)
  const slideTransitionTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)

  useEffect(() => {
    const contentChanged = prevContentKeyRef.current !== contentKey
    const becomingVisible = isVisible && !prevVisibleRef.current
    const becomingHidden = !isVisible && prevVisibleRef.current
    // Slide transition: content changed while already visible (navigating between slides)
    const slideTransition =
      isVisible && prevVisibleRef.current && contentChanged

    // Clear any pending RAF
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    // Clear any pending slide transition timeout
    if (slideTransitionTimeoutRef.current) {
      clearTimeout(slideTransitionTimeoutRef.current)
      slideTransitionTimeoutRef.current = null
    }

    if (becomingVisible) {
      // Simple enter animation (no exit needed - content wasn't visible before)
      setIsExitPhase(false)
      setIsSlideTransitionExitPhase(false)
      setIsStartPhase(true)
      setIsSlideTransition(false)
      setAnimationFrame((f) => f + 1)

      // After one frame, trigger the animation
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          setIsStartPhase(false)
        })
      })
    } else if (slideTransition) {
      // Two-phase slide transition: first exit old content, then enter new content
      // Phase 1: Start exit animation for old content (using slideTransitionOut)
      setIsSlideTransition(true)
      setIsSlideTransitionExitPhase(true)
      setSlideTransitionExitFrame((f) => f + 1)

      // Wait for exit animation to FULLY complete before showing new content
      // Add a small buffer (50ms) to ensure smooth transition
      const totalWaitTime = slideTransitionOutDuration + 50
      slideTransitionTimeoutRef.current = setTimeout(() => {
        // Phase 2: Start enter animation for new content (using slideTransitionIn)
        setIsSlideTransitionExitPhase(false)
        setIsStartPhase(true)
        setAnimationFrame((f) => f + 1)

        // Trigger the enter animation after one frame
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = requestAnimationFrame(() => {
            setIsStartPhase(false)
          })
        })
      }, totalWaitTime)
    } else if (becomingHidden) {
      // Start the synchronized exit animation sequence
      // All elements should start exiting at the same time
      setIsExitPhase(true)
      setIsSlideTransition(false)
      setIsSlideTransitionExitPhase(false)
      setExitFrame((f) => f + 1)
    }

    prevContentKeyRef.current = contentKey
    prevVisibleRef.current = isVisible

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      if (slideTransitionTimeoutRef.current) {
        clearTimeout(slideTransitionTimeoutRef.current)
      }
    }
  }, [contentKey, isVisible, slideTransitionOutDuration])

  const value = useMemo(
    () => ({
      animationFrame,
      isStartPhase,
      isExitPhase,
      exitFrame,
      isSlideTransition,
      isSlideTransitionExitPhase,
      slideTransitionExitFrame,
      slideTransitionOutDuration,
      slideTransitionInDuration,
    }),
    [
      animationFrame,
      isStartPhase,
      isExitPhase,
      exitFrame,
      isSlideTransition,
      isSlideTransitionExitPhase,
      slideTransitionExitFrame,
      slideTransitionOutDuration,
      slideTransitionInDuration,
    ],
  )

  return (
    <AnimationContext.Provider value={value}>
      {children}
    </AnimationContext.Provider>
  )
}

export function useAnimationContext() {
  return useContext(AnimationContext)
}
