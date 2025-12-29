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
}

const AnimationContext = createContext<AnimationContextValue>({
  animationFrame: 0,
  isStartPhase: false,
  isExitPhase: false,
  exitFrame: 0,
})

interface AnimationProviderProps {
  children: ReactNode
  // Key that triggers animation reset when changed
  contentKey: string
  // Whether content is visible
  isVisible: boolean
}

/**
 * Provides synchronized animation timing to all child AnimatedElements.
 * When contentKey changes, all elements start their animation in the same frame.
 * When isVisible becomes false, all elements start their exit animation together.
 */
export function AnimationProvider({
  children,
  contentKey,
  isVisible,
}: AnimationProviderProps) {
  const [animationFrame, setAnimationFrame] = useState(0)
  const [isStartPhase, setIsStartPhase] = useState(false)
  const [isExitPhase, setIsExitPhase] = useState(false)
  const [exitFrame, setExitFrame] = useState(0)
  const prevContentKeyRef = useRef(contentKey)
  const prevVisibleRef = useRef(isVisible)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const contentChanged = prevContentKeyRef.current !== contentKey
    const becomingVisible = isVisible && !prevVisibleRef.current
    const becomingHidden = !isVisible && prevVisibleRef.current

    // Clear any pending RAF
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    if (becomingVisible || (isVisible && contentChanged)) {
      // Start the synchronized enter animation sequence
      // Phase 1: Set start phase (all elements go to initial hidden state)
      setIsExitPhase(false)
      setIsStartPhase(true)
      setAnimationFrame((f) => f + 1)

      // Phase 2: After one frame, trigger the animation
      // Using double RAF ensures browser paints the start state first
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          setIsStartPhase(false)
        })
      })
    } else if (becomingHidden) {
      // Start the synchronized exit animation sequence
      // All elements should start exiting at the same time
      setIsExitPhase(true)
      setExitFrame((f) => f + 1)
    }

    prevContentKeyRef.current = contentKey
    prevVisibleRef.current = isVisible

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [contentKey, isVisible])

  const value = useMemo(
    () => ({
      animationFrame,
      isStartPhase,
      isExitPhase,
      exitFrame,
    }),
    [animationFrame, isStartPhase, isExitPhase, exitFrame],
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
