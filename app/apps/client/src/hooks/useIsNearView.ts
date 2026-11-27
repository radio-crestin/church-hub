import { useEffect, useRef, useState } from 'react'

/**
 * Whether an element has come within `margin` of the viewport (or of its
 * scrolling container). Stays true once it has: what was drawn stays drawn.
 */
export function useIsNearView<T extends Element>(margin = '600px') {
  const ref = useRef<T>(null)
  const [isNear, setIsNear] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || isNear) return
    if (typeof IntersectionObserver === 'undefined') {
      setIsNear(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setIsNear(true)
      },
      { rootMargin: margin },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [isNear, margin])

  return [ref, isNear] as const
}
