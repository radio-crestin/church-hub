import { type RefObject, useEffect, useState } from 'react'

/** The size of an element as it is laid out, kept up as it changes. */
export function useBoxSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])
  return size
}
