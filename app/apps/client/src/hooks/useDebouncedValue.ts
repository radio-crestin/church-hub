import { useCallback, useEffect, useRef, useState } from 'react'

interface UseDebouncedValueReturn<T> {
  debouncedValue: T
  triggerImmediately: () => void
  isPending: boolean
}

export function useDebouncedValue<T>(
  value: T,
  delay: number = 1500,
): UseDebouncedValueReturn<T> {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  const [isPending, setIsPending] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestValueRef = useRef<T>(value)

  latestValueRef.current = value

  useEffect(() => {
    if (value === debouncedValue) {
      setIsPending(false)
      return
    }

    setIsPending(true)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value)
      setIsPending(false)
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [value, delay, debouncedValue])

  const triggerImmediately = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setDebouncedValue(latestValueRef.current)
    setIsPending(false)
  }, [])

  return { debouncedValue, triggerImmediately, isPending }
}
