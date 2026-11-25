import { useEffect, useRef, useState } from 'react'

/**
 * A popover anchored under the right edge of its button, kept on screen,
 * closed by a click outside it or Escape.
 */
export function useAnchoredPopover(width: number) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!anchor) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        !popoverRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      )
        setAnchor(null)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAnchor(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [anchor])

  const open = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    setAnchor({
      x: Math.max(
        8,
        Math.min(rect.right - width, window.innerWidth - width - 8),
      ),
      y: rect.bottom + 4,
    })
  }

  return { buttonRef, popoverRef, anchor, open, close: () => setAnchor(null) }
}
