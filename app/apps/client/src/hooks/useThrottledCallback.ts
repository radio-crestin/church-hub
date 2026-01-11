import { useCallback, useRef } from 'react'

export function useThrottledCallback<
  T extends (...args: Parameters<T>) => void,
>(callback: T, delay: number): T {
  const lastCallRef = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastArgsRef = useRef<Parameters<T> | null>(null)

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      const timeSinceLastCall = now - lastCallRef.current

      lastArgsRef.current = args

      if (timeSinceLastCall >= delay) {
        lastCallRef.current = now
        callback(...args)
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now()
          if (lastArgsRef.current) {
            callback(...lastArgsRef.current)
          }
        }, delay - timeSinceLastCall)
      }
    },
    [callback, delay],
  ) as T
}
